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
from dataclasses import Field, asdict, dataclass, field, is_dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    ClassVar,
    Protocol,
    Sequence,
    TypeGuard,
    TypeVar,
    overload,
)
import warnings
import weakref

from psygnal import evented, EmissionInfo, SignalGroup
from .widget import DEFAULT_ESM
from ._util import (
    open_comm,
    _PROTOCOL_VERSION_MAJOR,
    _PROTOCOL_VERSION_MINOR,
    _remove_buffers,
    _put_buffers,
)

if TYPE_CHECKING:  # pragma: no cover
    from ipykernel.comm import Comm
    from ._protocols import CommMessage

    class MimeReprCallable(Protocol):
        def __call__(
            self, include: Sequence[str], exclude: Sequence[str]
        ) -> dict | tuple[dict, dict]:
            ...

    class AnywidgetProtocol(Protocol):
        _repr_mimebundle_: MimeReprCaller


_JUPYTER_MIME = "application/vnd.jupyter.widget-view+json"
_ANYWIDGET_FLAG = "__anywidget_repr__"
_REPR_ATTR = "_repr_mimebundle_"
_T = TypeVar("_T")
T = TypeVar("T", bound="type[Any]")


# this preserves the signature and typing of the decorated class
# https://github.com/microsoft/pyright/blob/main/specs/dataclass_transforms.md
def __dataclass_transform__(
    *,
    eq_default: bool = True,
    order_default: bool = False,
    kw_only_default: bool = False,
    field_specifiers: tuple[type | Callable[..., Any], ...] = (()),
) -> Callable[[_T], _T]:
    return lambda a: a


@__dataclass_transform__(field_specifiers=(Field, field))
@overload
def anywidget(cls: T) -> T:
    ...


@__dataclass_transform__(field_specifiers=(Field, field))
@overload
def anywidget(
    *,
    follow_changes: bool = True,
    **dataclass_kwargs: Any,
) -> Callable[[T], T]:
    ...


def anywidget(
    cls: T | None = None,
    *,
    esm: str = DEFAULT_ESM,
    follow_changes: bool = True,
    **dataclass_kwargs: Any,
) -> T | Callable[[T], T]:
    """Turn class into a dataclass with an Anywidget _repr_mimebundle_ method.
    
    Parameters
    ----------
    cls : type, optional
        The class to decorate, by default None
    esm : str, optional
        The javascript module that will be used to create the widget
        view, by default DEFAULT_ESM
    follow_changes : bool, optional
        If True (the default), the widget view will be updated when the python model
        changes.
    **dataclass_kwargs
        Additional keyword arguments to pass to the `dataclasses.dataclass` decorator.
    """

    def _deco(cls: T) -> T:
        if dataclass_kwargs.get("frozen", False):
            raise ValueError(
                "The 'anywidget' decorator does not support dataclasses with "
                "`frozen=True`. If you need this feature, please open an issue at "
                "https://github.com/manzt/anywidget/issues."
            )

        # assign the name "_repr_mimebundle_" to the ReprBuilder descriptor
        setattr(cls, _REPR_ATTR, ReprBuilder(esm, follow_changes))

        # make sure we've got an evented dataclass
        if not is_dataclass(cls):
            cls = dataclass(cls, **dataclass_kwargs)  # type: ignore
        # TODO: check if evented already?
        cls = evented(cls)

        # set a flag so we know this is an anywidget class
        setattr(cls, _ANYWIDGET_FLAG, True)
        return cls

    return _deco(cls) if cls is not None else _deco


def is_anywidget(obj: object) -> TypeGuard[AnywidgetProtocol]:
    """Return `True` if obj is an anywidget class or an instance of an anywidget."""
    return hasattr(obj, _ANYWIDGET_FLAG)


# cache of all open communications, keyed by object id
_COMMS: dict[int, Comm] = {}


def comm_for(obj: object) -> Comm:
    """Get or create a communcation channel for a given object."""
    # NOTE: this is not a totally safe way to create an id for an object
    # but we can't assume that the object has a __hash__ method
    obj_id = id(obj)
    if obj_id not in _COMMS:
        _COMMS[obj_id] = open_comm()
        weakref.finalize(obj, _COMMS.pop, obj_id)
    return _COMMS[obj_id]


class ReprBuilder:
    """Descriptor that builds a widget for a dataclass or instance.
    
    The __get__ method is called when the descriptor's name is accessed on a class or
    instance.

    Examples
    --------

    class Foo:
        # technically, you could name this anything you want
        # but it only makes sense to call it _repr_mimebundle_
        _repr_mimebundle_ = ReprBuilder()
    
    foo = Foo()
    foo  # when done in a jupyter notebook, this line will access the descriptor
    """

    def __init__(self, esm: str = DEFAULT_ESM, follow_changes: bool = True):
        self._esm = esm
        self._name = _REPR_ATTR
        self._follow_changes = follow_changes

    def __set_name__(self, owner: type, name: str) -> None:
        """Called when the descriptor is added to a class."""
        self._name = name

    def __get__(
        self, instance: object | None, owner: type
    ) -> MimeReprCallable | ReprBuilder:
        """Called when the descriptor's name is accessed on a class or instance."""
        if instance is None:
            # we're being accessed on the class
            return self

        # we're being accessed on an instance
        # create a MimeReprCaller that can serve as a _repr_mimebundle_ method
        # but also manages the comm channel between the js view and the python model
        repr_obj = MimeReprCaller(instance, self._esm)
        if self._follow_changes:
            repr_obj.bind_instance()

        with contextlib.suppress(AttributeError):
            # cache it on the instance
            # this MAY fail in cases of __slots__ other attribute restrictions
            # the cost is that the MimeReprCaller will be rebuilt on each access
            # but it should still work.
            setattr(instance, self._name, repr_obj)
            # call `del instance._repr_mimebundle_` to remove it
        return repr_obj


class MimeReprCaller:
    """Callable object that behaves like a _repr_mimebundle_ method...

    But also manages the communcation channel between the js view and the python model.

    Parameters
    ----------
    obj : object
        The object to build a widget for.  Most likely this will be a dataclass instance
        that has been made "evented" by the anywidget decorator... but we type it as
        `object` to allow for other use cases, to make it clearer what protocols we
        expect from the object.
    esm : str
        The content of an ES module exporting a function named `render`.
    """
    _get_state: Callable[[], dict]

    def __init__(self, obj: object, esm: str):
        self._esm = esm
        self._obj = weakref.ref(obj, self._on_obj_deleted)
        self._comm = comm_for(obj)

        # figure out what type of object we're working with, and how it "gets state".
        # TODO: these lambdas should probably be defined at the module level
        if is_dataclass(obj):
            self._get_state = lambda: asdict(obj)
        # elif (
        #     hasattr(obj, "dict")
        #     and "pydantic" in sys.modules
        #     and isinstance(obj, sys.modules["pydantic"].BaseModel)
        # ):
        #     self._get_state = obj.dict
        elif hasattr(obj, "__getstate__"):
            # pickle protocol
            self._get_state = obj.__getstate__
        elif hasattr(obj, "_get_state"):
            # here as an escape hatch if not a dataclass and not pickleable
            # but obj.__dict__ is not serializable
            self._get_state = obj._get_state
        else:
            # fallback ... probably not a good idea as it will be rarely serializable
            self._get_state = lambda: obj.__dict__

    # TODO: this idea could be useful for validating the esm string
    # as well as for reloading the view if a watched file changes (in DEV mode)
    # @property
    # def _esm_string(self) -> str:
    #     """Return the esm string, with a trailing newline."""
    #     from pathlib import Path

    #     esm = Path(self._esm).read_text() if Path(self._esm).exists() else self._esm
    #     if "function render" not in esm:
    #         # TODO: ask trevor about validating the string
    #         # then return JS code that explains the error in a repr
    #         raise ValueError('The esm string must export a function named "render"')
    #     return esm

    def _on_obj_deleted(self, ref: weakref.ReferenceType):
        """Called when the python object is deleted."""
        self._comm.close()
        # could swap out esm here for a "deleted" message
        
    def send_state(self, include: set[str] | None = None) -> None:
        """Send state or a part of it to the js view."""
        state = self._get_state()
        if include is not None:
            state = {k: v for k, v in state.items() if k in include}
            if "_esm" in include:
                state["_esm"] = self._esm
        else:
            state["_esm"] = self._esm

        if not state:
            return

        # if self._property_lock: ... # TODO
        state, buffer_paths, buffers = _remove_buffers(state)
        if self._comm.kernel is not None:  # type: ignore
            msg = {"method": "update", "state": state, "buffer_paths": buffer_paths}
            self._comm.send(data=msg, buffers=buffers)

    def _on_event(self, event: EmissionInfo):
        """Called whenever the python model changes"""
        self.send_state({event.signal.name})

    def _set_pymodel_state(self, state: dict):
        obj = self._obj()
        if obj is None:
            return
        for key, val in state.items():
            setattr(obj, key, val)

    def _handle_msg(self, msg: CommMessage):
        """Called when a msg is received from the front-end"""
        data = msg["content"]["data"]

        if data["method"] == "update":
            if "state" in data:
                state = data["state"]
                if "buffer_paths" in data:
                    _put_buffers(state, data["buffer_paths"], msg["buffers"])
                self._set_pymodel_state(state)

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

    def bind_instance(self, two_way: bool = True) -> None:
        """Bind the view to changes in a model instance.

        If `two_way` is True, changes in the instance will also be sent to the view.
        """
        # connect changes in the view to the instance
        self._comm.on_msg(self._handle_msg)
        self.send_state()

        events = getattr(self._obj(), "events", None)
        if isinstance(events, SignalGroup) and two_way:
            # connect changes in the instance to the view
            events.connect(self._on_event)

    def unbind_instance(self) -> None:
        """Unbind the view from changes in a model instance."""
        self._comm.on_msg(None)

        events = getattr(self._obj(), "events", None)
        if isinstance(events, SignalGroup):
            with contextlib.suppress(ValueError):
                events.disconnect(self._on_event)


# Class-based form ... which provides subclassing and inheritance (unlike @guiclass)


@__dataclass_transform__(field_specifiers=(Field, field))
class AnyWidgetMeta(type):
    def __new__(cls: type, name: str, bases: tuple, attrs: dict, **kwargs) -> type:
        attrs[_ANYWIDGET_FLAG] = True
        obj: type = type.__new__(cls, name, bases, attrs)
        obj = evented(dataclass(obj))
        setattr(obj, "_repr_mimebundle_", ReprBuilder(**kwargs))
        return obj


# evented will warn "No mutable fields found in class <class '__main__.GuiClass'>"
# no events will be emitted... but it will work fine for subclasses.
with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=UserWarning)

    class AnyWidget(metaclass=AnyWidgetMeta):
        _repr_mimebundle_: ClassVar[ReprBuilder]

        if TYPE_CHECKING:
            events: ClassVar[SignalGroup]

            # the mypy dataclass magic doesn't work without the literal decorator
            # it WILL work with pyright due to the __dataclass_transform__ above
            # here we just avoid a false error in mypy
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                ...