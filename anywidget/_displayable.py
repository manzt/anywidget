from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable
from ipykernel.comm import Comm
from psygnal import EventedModel, EmissionInfo
from pydantic import PrivateAttr
from dataclasses import is_dataclass, asdict
from ._util import _remove_buffers, _put_buffers, open_comm, _PROTOCOL_VERSION_MAJOR, _PROTOCOL_VERSION_MINOR

if TYPE_CHECKING:
    from ._protocols import CommMessage


class _Displayable:
    _JUPYTER_MIME = "application/vnd.jupyter.widget-view+json"
    _MAX_REPR_SIZE = 110
    _comm: Comm

    def _get_state(self, include: Iterable[str] | None = None) -> dict:
        """Serialize this object into a state dict.

        Default implementation works for dataclasses, but will likely need to be
        reimplemented for anything else.

        Parameters
        ----------
        include : Iterable[str], optional
            A set of attribute names to include in the state, by default None (all).
        """
        if is_dataclass(self):
            state = asdict(self)
        else:
            state = getattr(self, "__dict__", None)
            if state is None:
                raise TypeError(f"Cannot serialize {self!r} to a state dict")
        if include is not None:
            state = {k: v for k, v in state.items() if k in set(include)}
        return state

    def _set_state(self, state: dict) -> None:
        # MAY be overriden by subclasses... this default works for, e.g.
        # dataclasses, pydantic, attrs...
        for key, val in state.items():
            setattr(self, key, val)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        self._comm = open_comm()
        self._comm.on_msg(self._handle_msg)
        self._send_state()

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
            self._send_state()

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

    def _send_state(self, include: Iterable[str] | None = None) -> None:
        """Send state or a part of it"""
        state = self._get_state(include)
        if not state:
            return

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
                "version_major": _PROTOCOL_VERSION_MAJOR,
                "version_minor": _PROTOCOL_VERSION_MINOR,
                "model_id": self._comm.comm_id,
            },
        }


class Displayable(_Displayable, EventedModel):
    _comm: Comm = PrivateAttr(None)

    def __init__(_model_self_, **data: Any) -> None:
        super().__init__(**data)
        # send state on ANY change
        _model_self_.events.connect(_model_self_._on_event)

    def _on_event(self, event: EmissionInfo):
        """Called whenever the python model changes"""
        self._send_state({event.signal.name})

    def _get_state(self, include: Iterable[str] | None = None) -> dict:
        state = self.dict(include=set(include) if include else None)

        if "esm" in state:  # TODO
            state["_esm"] = state.pop("esm")  # can fix... cause pydantic doesn't want _
        return state
