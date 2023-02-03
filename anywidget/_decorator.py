from typing import Any, Callable, Iterable, TypeVar
from psygnal import evented, EmissionInfo
from dataclasses import dataclass, is_dataclass
from ._displayable import _Displayable, open_comm
from .widget import DEFAULT_ESM

T = TypeVar("T")


# TODO: this will move to psygnal
def _is_evented(cls: Any) -> bool:
    return getattr(cls.__setattr__, "__module__", "").startswith("psygnal")


def anywidget(
    _cls: T | None = None, *, esm: str = DEFAULT_ESM, css: str | None = None
) -> Callable[[T], T]:
    def _get_state(obj: object, include: Iterable[str] | None = None) -> dict:
        state = _Displayable._get_state(obj, include)
        if include is None or "_esm" in include:
            state["_esm"] = esm
        if (include is None or "_css" in include) and css:
            state["_css"] = css
        return state

    def anywidget_decorator(cls: T) -> T:
        if not isinstance(cls, type):  # pragma: no cover
            raise TypeError("anywidget decorator can only be used on classes")

        if not is_dataclass(cls):
            cls = dataclass(cls)
        cls = type(
            f"{cls.__name__}Widget",
            (cls, _Displayable),
            {"_get_state": _get_state},
        )
        if not _is_evented(cls):
            cls = evented(cls, events_namespace="events")

        original_init = cls.__init__

        def __comm_init__(self: _Displayable, *args: Any, **kwargs: Any) -> None:
            original_init(self, *args, **kwargs)
            self._comm = open_comm()
            self._comm.on_msg(self._handle_msg)
            self._send_state()

            @self.events.connect
            def _on_event(event: EmissionInfo):
                """Called whenever the python model changes"""
                self._send_state({event.signal.name})

        cls.__init__ = __comm_init__
        return cls

    return anywidget_decorator(_cls) if _cls is not None else anywidget_decorator