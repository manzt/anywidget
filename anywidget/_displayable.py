from typing import Any, Container, Generic, TypeVar, cast, TypedDict, Literal
from ipykernel.comm import Comm
from psygnal import EventedModel, EmissionInfo
from pydantic import PrivateAttr


class UpdateData(TypedDict):
    method: Literal["update"]
    state: dict
    buffer_paths: list[list[int | str]]


class RequestStateData(TypedDict):
    method: Literal["request_state"]


ContentT = TypeVar("ContentT")


class CustomData(TypedDict, Generic[ContentT]):
    method: Literal["custom"]
    content: ContentT


class JupyterWidgetContent(TypedDict):
    comm_id: str
    data: UpdateData | RequestStateData | CustomData


class CommMessage(TypedDict):
    header: dict
    msg_id: str
    msg_type: str
    parent_header: dict
    metadata: dict
    content: JupyterWidgetContent
    buffers: list[memoryview]


class Displayable(EventedModel):
    _JUPYTER_MIME = "application/vnd.jupyter.widget-view+json"
    _MAX_REPR_SIZE = 110
    _PROTOCOL_VERSION_MAJOR = 2
    _PROTOCOL_VERSION_MINOR = 1
    _comm: Comm = PrivateAttr(default=None)

    esm: str

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        version = f"{self._PROTOCOL_VERSION_MAJOR}.{self._PROTOCOL_VERSION_MINOR}.0"
        self._comm = Comm(
            target_name="jupyter.widget",
            metadata={"version": version},
            buffers=[],
            data={
                "state": {
                    "_model_module": "anywidget",
                    "_model_name": "AnyModel",
                    "_model_module_version": "0.1.0",
                    "_view_count": None,
                    "_view_module": "anywidget",
                    "_view_name": "AnyView",
                    "_view_module_version": "0.1.0",
                }
            },
        )
        self._comm.on_msg(self._handle_msg)
        self.send_state()
        # send state on ANY change
        self.events.connect(self._on_event)

    def _handle_msg(self, msg: CommMessage):
        """Called when a msg is received from the front-end"""
        data = msg["content"]["data"]

        if data["method"] == "update":
            if "state" in data:
                state = data["state"]
                if "buffer_paths" in data:
                    _put_buffers(state, data["buffer_paths"], msg["buffers"])
                self.set_state(state)

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

    def set_state(self, state):
        for key, val in state.items():
            setattr(self, key, val)

    def _handle_custom_msg(self, content: Any, buffers: list[memoryview]):
        # TODO: handle custom callbacks
        # https://github.com/jupyter-widgets/ipywidgets/blob/6547f840edc1884c75e60386ec7fb873ba13f21c/python/ipywidgets/ipywidgets/widgets/widget.py#L662
        ...

    def _on_event(self, event: EmissionInfo):
        """Called whenever the python model changes"""
        self.send_state({event.signal.name})

    def send_state(self, include: Container[str] | None = None):
        """Send state or a part of it"""
        state = self.dict(include=include)  # type: ignore
        if not state:
            return

        if "esm" in state:
            state["_esm"] = state.pop("esm")  # can fix... cause pydantic doesn't want _
        # if self._property_lock: ... # TODO
        state, buffer_paths, buffers = _remove_buffers(state)
        if self._comm.kernel is not None:
            msg = {"method": "update", "state": state, "buffer_paths": buffer_paths}
            self._comm.send(data=msg, buffers=buffers)

    def _repr_mimebundle_(self, **kwargs) -> dict:
        plaintext = repr(self)
        if len(plaintext) > self._MAX_REPR_SIZE:
            plaintext = f"{plaintext[:self._MAX_REPR_SIZE]}…"
        return {
            "text/plain": plaintext,
            self._JUPYTER_MIME: {
                "version_major": self._PROTOCOL_VERSION_MAJOR,
                "version_minor": self._PROTOCOL_VERSION_MINOR,
                "model_id": self._comm.comm_id,
            },
        }


_BINARY_TYPES = (memoryview, bytearray, bytes)
T = TypeVar("T", list, dict, tuple)


def _separate_buffers(substate: T, path: list, buffer_paths: list, buffers: list) -> T:
    """For internal, see _remove_buffers.

    remove binary types from dicts and lists, but keep track of their paths any part of
    the dict/list that needs modification will be cloned, so the original stays
    untouched e.g. {'x': {'ar': ar}, 'y': [ar2, ar3]}, where ar/ar2/ar3 are binary types
    will result in {'x': {}, 'y': [None, None]}, [ar, ar2, ar3], [['x', 'ar'], ['y', 0],
    ['y', 1]] instead of removing elements from the list, this will make replacing the
    buffers on the js side much easier
    """
    _t = type(substate)
    _sub: list | dict
    if isinstance(substate, (list, tuple)):
        _sub = list(substate)
        for i, v in enumerate(substate):
            if isinstance(v, _BINARY_TYPES):
                _sub[i] = None
                buffers.append(v)
                buffer_paths.append(path + [i])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [i], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    _sub[i] = _v
    elif isinstance(substate, dict):
        _sub = dict(substate)
        for k, v in substate.items():
            if isinstance(v, _BINARY_TYPES):
                del _sub[k]
                buffers.append(v)
                buffer_paths.append(path + [k])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [k], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    _sub[k] = _v
    else:
        raise ValueError("expected state to be a list or dict, not %r" % substate)
    return _t(_sub)


def _remove_buffers(state: T) -> tuple[T, list[list], list[memoryview]]:
    """Return (state_without_buffers, buffer_paths, buffers) for binary message parts

    A binary message part is a memoryview, bytearray, or python 3 bytes object.

    Examples
    --------
    >>> ar1 = np.arange(8).reshape(4, 2)
    >>> ar2 = np.arange(100).reshape(10, 10)
    >>> state = {
            'plain': [0, 'text'],
            'x': {'ar': memoryview(ar1)},
            'y': {'shape': (10,10), 'data': memoryview(ar2)}
        }
    >>> _remove_buffers(state)
    (
        {
            'plain': [0, 'text'],
            'x': {},
            'y': {'shape': (10, 10)}
        },
        [['x', 'ar'], ['y', 'data']],
        [<memory at 0x114e7fac0>, <memory at 0x114e7fed0>]
    )
    """
    buffer_paths: list = []
    buffers: list[memoryview] = []
    state = _separate_buffers(state, [], buffer_paths, buffers)
    return state, buffer_paths, buffers


def _put_buffers(
    state: dict,
    buffer_paths: list[list[str | int]],
    buffers: list[memoryview],
):
    """The inverse of _remove_buffers, except here we modify the existing dict/lists.
    Modifying should be fine, since this is used when state comes from the wire.
    """
    for buffer_path, buffer in zip(buffer_paths, buffers):
        # we'd like to set say sync_data['x'][0]['y'] = buffer
        # where buffer_path in this example would be ['x', 0, 'y']
        obj = state
        for key in buffer_path[:-1]:
            obj = obj[key]
        obj[buffer_path[-1]] = buffer
