"""anywidget dataclass decorator that lazily creates a jupyter widget view.

This pattern works as follows:

1. user decorates a class with `@anywidget`
    - if the class is not already a dataclass, it is turned into one
    - the class is also made "evented" using psygnal
      see psygnal: https://psygnal.readthedocs.io/en/latest/dataclasses/
    - the class is given a `_repr_mimebundle_` attribute that is an instance of
      `ReprBuilder` (see #2)
2. `ReprBuilder` is a descriptor: https://docs.python.org/3/howto/descriptor.html
    when the `_repr_mimebundle_` attribute is accessed on an instance of the decorated
    class, a `MimeReprCaller` instance is created and returned.
3. A `MimeReprCaller` is first and foremost a callable object that implements the 
   `_repr_mimebundle_` protocol that jupyter expects.  However, it also manages an
   ipykernel Comm instance that is used to send the state of the python model to the
    javascript view.  This is done lazily, so that the Comm is only created when the
    `_repr_mimebundle_` is first accessed.
4. `MimeReprCaller` has the logic to get/set the state of the python model, and will
    keep the two in sync ("bind"/"unbind_instance" methods can be used to control this).
"""

from __future__ import annotations

import contextlib
import json
import sys
import warnings
import weakref
from dataclasses import asdict, is_dataclass
from typing import TYPE_CHECKING, Any, Callable


from ._util import _put_buffers, _remove_buffers
from ._version import __version__
from .widget import DEFAULT_ESM

if TYPE_CHECKING:  # pragma: no cover
    from ipykernel.comm import Comm
    from pydantic import BaseModel
    from typing_extensions import TypeGuard
    from psygnal import EmissionInfo, SignalGroup

    from ._protocols import CommMessage, MimeReprCallable


_JUPYTER_MIME = "application/vnd.jupyter.widget-view+json"
_REPR_ATTR = "_repr_mimebundle_"
_STATE_GETTER_NAME = "_get_state"
_STATE_SETTER_NAME = "_set_state"


# cache of comms: mapp of id(obj) -> Comm.
# we use id(obj) rather than WeakKeyDictionary because we can't assume that the
# object has a __hash__ method
_COMMS: dict[int, Comm] = {}

_PROTOCOL_VERSION_MAJOR = 2
_PROTOCOL_VERSION_MINOR = 1
_VERSION = f"{_PROTOCOL_VERSION_MAJOR}.{_PROTOCOL_VERSION_MINOR}.0"
_TARGET = "jupyter.widget"
_ANYWIDGET_MODEL_NAME = "AnyModel"
_ANYWIDGET_VIEW_NAME = "AnyView"
_ANYWIDGET_JS_MODULE = "anywidget"
_ANYWIDGET_STATE = {
    "_model_module": _ANYWIDGET_JS_MODULE,
    "_model_name": _ANYWIDGET_MODEL_NAME,
    "_model_module_version": __version__,
    "_view_module": _ANYWIDGET_JS_MODULE,
    "_view_name": _ANYWIDGET_VIEW_NAME,
    "_view_module_version": __version__,
    "_view_count": None,
}


def open_comm(target_name: str = _TARGET, version: str = _VERSION, **kwargs) -> Comm:
    from ipykernel.comm import Comm

    return Comm(
        target_name=target_name,
        metadata={"version": version},
        data={"state": _ANYWIDGET_STATE},
    )


def _comm_for(obj: object) -> Comm:
    """Get or create a communcation channel for a given object.

    Comms are cached by object id, so that if the same object is used in multiple
    places, the same comm will be used. Comms are deleted when the object is garbage
    collected.
    """
    # NOTE: this is not a totally safe way to create an id for an object
    # since it's possible that the id could be reused.  However, that will only happen
    # after object deletion, so the "risk" seems rather minimal.
    obj_id = id(obj)
    if obj_id not in _COMMS:
        _COMMS[obj_id] = open_comm()
        # when the object is garbage collected, remove the comm from the cache
        weakref.finalize(obj, _COMMS.pop, obj_id)
    return _COMMS[obj_id]


class MimeBundleDescriptor:
    """Descriptor that builds a ReprMimeBundle when accessed on an instance.

    The `__get__` method is called when the descriptor's name is accessed on a class or
    instance.  It returns a `ReprMimeBundle` instance, which is a callable that
    implements the `_repr_mimebundle_` protocol that jupyter expects, but also manages
    the comm channel between the python model and the javascript view.

    For more on descriptors, see: <https://docs.python.org/3/howto/descriptor.html>

    Examples
    --------
    >>> class Foo:
    ...     # technically, you could name this anything you want
    ...     # but it only makes sense to call it _repr_mimebundle_
    ...     _repr_mimebundle_ = MimeBundleDescriptor()

    >>> foo = Foo()
    >>> foo  # in a jupyter notebook, this line will access _repr_mimebundle_
    """

    def __init__(self, follow_changes: bool = True, **extra_state: Any) -> None:
        extra_state.setdefault("_esm", DEFAULT_ESM)
        self._extra_state = extra_state
        self._name = _REPR_ATTR
        self._follow_changes = follow_changes

    def __set_name__(self, owner: type, name: str) -> None:
        """Called when this descriptor is assigned to an attribute on a class.

        In most cases, we won't *want* `name` to be anything other than
        `'_repr_mimebundle_'`.  This could conceivably emit a warning if that's the
        case.
        """
        self._name = name

    def __get__(
        self, instance: object | None, owner: type
    ) -> MimeReprCallable | MimeBundleDescriptor:
        """Called when this descriptor's name is accessed on a class or instance.

        Examples
        --------
        >>> class Foo:
        ...     _repr_mimebundle_ = MimeBundleDescriptor()
        ...
        >>> Foo._repr_mimebundle_  # same as Foo._repr_mimebundle_.__get__(None, Foo)
        >>> foo = Foo()
        >>> foo._repr_mimebundle_  # same as Foo._repr_mimebundle_.__get__(foo, Foo)
        """
        if instance is None:
            # we're being accessed on the class, just return the descriptor itself.
            return self

        # we're being accessed on an instance ...
        # create the ReprMimeBundle serves as a _repr_mimebundle_ method on the instance
        repr_obj = ReprMimeBundle(instance, extra_state=self._extra_state)
        if self._follow_changes:
            # set up two way data binding
            repr_obj.sync_object_with_view()

        with contextlib.suppress(AttributeError):
            # this line overrides the attribute on the instance with the ReprMimeBundle
            # we just created. This is so that the next time the attribute is accessed,
            # we don't have to create a new ReprMimeBundle.
            setattr(instance, self._name, repr_obj)
            # We catch AttributeError, as this MAY fail in cases of __slots__ other
            # setattr restrictions. The "cost" would be that the ReprMimeBundle will be
            # rebuilt on each access but it should still work.
            # You can call `del instance._repr_mimebundle_` to remove the RepMimeBundle

        return repr_obj


class ReprMimeBundle:
    """Callable object that behaves like a `_repr_mimebundle_` method...

    which is to say, it returns a mimebundle when called.

    However, this object *also* manages the communcation channel between the js view
    and some python model object (`obj`).

    Parameters
    ----------
    obj : object
        The python model object which is being represented by the view.  Most likely
        this will be a dataclass instance that has been made "evented" by the anywidget
        decorator... but we type it as `object` to allow for other use cases, to make it
        clearer what protocols we expect from the object.
    esm : str
        The content of an ES module exporting a function named `render`.
    """

    def __init__(self, obj: object, extra_state: dict[str, Any] | None = None):
        self._extra_state = extra_state or {}
        self._obj = weakref.ref(obj, self._on_obj_deleted)
        self._comm = _comm_for(obj)

        # figure out what type of object we're working with, and how it "get state".
        self._get_state = determine_state_getter(obj)
        self._set_state = determine_state_setter(obj)

    def _on_obj_deleted(self, ref: weakref.ReferenceType):
        """Called when the python object is deleted."""
        self._comm.close()
        # could swap out esm here for a "deleted" message, or any number of things.

    def send_state(self, include: set[str] | None = None) -> None:
        """Send state update to the front-end view.

        Parameters
        ----------
        include : set of str, optional
            If provided, only send the state for the keys in this set.  Otherwise,
            send all state.
        """
        obj = self._obj()
        if obj is None:
            return  # the python object has been deleted

        state = {**self._get_state(obj), **self._extra_state}
        if include is not None:
            state = {k: v for k, v in state.items() if k in include}

        if not state:
            return

        # if self._property_lock: ... # TODO
        state, buffer_paths, buffers = _remove_buffers(state)
        if self._comm.kernel is not None:  # type: ignore
            msg = {"method": "update", "state": state, "buffer_paths": buffer_paths}
            self._comm.send(data=msg, buffers=buffers)

    def _handle_msg(self, msg: CommMessage):
        """Called when a msg is received from the front-end"""
        data = msg["content"]["data"]

        if data["method"] == "update":
            if "state" in data:
                state = data["state"]
                if "buffer_paths" in data:
                    _put_buffers(state, data["buffer_paths"], msg["buffers"])
                self._set_state(state)

        # Handle a state request.
        elif data["method"] == "request_state":
            self.send_state()

        # Handle a custom msg from the front-end.
        elif data["method"] == "custom":
            if "content" in data:
                self._handle_custom_msg(data["content"], msg["buffers"])

        else:
            # TODO: log unknown message or raise an Exception?
            ...

    def _handle_custom_msg(self, content: Any, buffers: list[memoryview]):
        # TODO: handle custom callbacks
        # https://github.com/jupyter-widgets/ipywidgets/blob/6547f840edc1884c75e60386ec7fb873ba13f21c/python/ipywidgets/ipywidgets/widgets/widget.py#L662
        ...

    def __call__(self, **kwargs) -> dict:
        """Called when _repr_mimebundle_ is called on the python model."""
        # NOTE: this could conceivably be a method on a Comm subclass
        # (i.e. the comm knows how to represent itself as a mimebundle)
        return {
            "text/plain": repr(self),
            _JUPYTER_MIME: {
                "version_major": _PROTOCOL_VERSION_MAJOR,
                "version_minor": _PROTOCOL_VERSION_MINOR,
                "model_id": self._comm.comm_id,
            },
        }

    def _on_psygnal_event(self, event: EmissionInfo):
        """Called whenever the python model changes"""
        self.send_state({event.signal.name})

    def sync_object_with_view(
        self, py_to_js: bool = True, js_to_py: bool = True
    ) -> None:
        """Bind the view to changes in a model instance."""
        if js_to_py:
            # connect changes in the view to the instance
            self._comm.on_msg(self._handle_msg)
            self.send_state()

        if py_to_js:
            # connect changes in the instance to the view
            events = _get_psygnal_signal_group(self._obj())
            if events is not None:
                events.connect(self._on_psygnal_event)
            else:
                warnings.warn(
                    "The object being synced does not have an 'events' SignalGroup. "
                    "Unclear how to follow changes."
                )

    def unsync_object_with_view(self) -> None:
        """Unbind the view from changes in a model instance."""
        self._comm.on_msg(None)

        events = _get_psygnal_signal_group(self._obj())
        if events is not None:
            with contextlib.suppress(ValueError):
                events.disconnect(self._on_psygnal_event)


def _get_psygnal_signal_group(obj: object) -> SignalGroup | None:
    """Look for a psygnal.SignalGroup on the obj."""
    psygnal = sys.modules.get("psygnal")
    if psygnal is None:
        return None

    # most likely case
    events = getattr(obj, "events", None)
    if isinstance(events, psygnal.SignalGroup):
        return events

    # exhaustive search
    for name in dir(obj):
        attr = getattr(obj, name)
        if isinstance(attr, psygnal.SignalGroup):
            return attr


def _is_pydantic_model(obj: Any) -> TypeGuard[BaseModel]:
    """Check if an object is a pydantic BaseModel."""
    return "pydantic" in sys.modules and isinstance(
        obj, sys.modules["pydantic"].BaseModel
    )


def _get_pydantic_state(obj: BaseModel) -> dict:
    """Get the state of a pydantic BaseModel instance.

    To take advantage of pydantic's support for custom encoders (with json_encoders)
    we call obj.json() here, and then cast back to a dict (which is what the comm
    expects.)
    """
    return json.load(obj.json())


def determine_state_getter(obj: object) -> Callable[[object], dict]:
    """ "For `obj`... figure out how it can be serialized to a dict."""

    if is_dataclass(obj):
        # caveat: if the dict is not JSON serializeable... you still need to
        # provide an API for the user to customize serialization
        return asdict

    if _is_pydantic_model(obj):
        return _get_pydantic_state

    # check on the class for our special state getter method
    if hasattr(type(obj), _STATE_GETTER_NAME):
        return getattr(type(obj), _STATE_GETTER_NAME)

    # pickle protocol ... probably not type-safe enough for our purposes
    # https://docs.python.org/3/library/pickle.html#object.__getstate__
    # if hasattr(type(obj), "__getstate__"):
    #     return type(obj).__getstate__

    raise TypeError(
        f"Cannot determine state getter for {obj!r}. "
        "Please implement a `_get_state()` method that returns a dict."
    )


def _default_set_state(obj: object, state: dict) -> None:
    for key, val in state.items():
        setattr(obj, key, val)


def determine_state_setter(obj: object) -> Callable[[object, dict], None]:
    if hasattr(obj, _STATE_SETTER_NAME):
        return getattr(obj, _STATE_SETTER_NAME)

    return _default_set_state
