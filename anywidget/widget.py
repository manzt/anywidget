"""AnyWidget base class for custom Jupyter widgets."""

from __future__ import annotations

from typing import Any, Callable

import traitlets

from ._descriptor import MimeBundleDescriptor
from ._util import _CSS_KEY, _ESM_KEY
from .experimental import _collect_anywidget_commands, _register_anywidget_commands


class AnyWidget(traitlets.HasTraits):  # type: ignore [misc]
    """Main AnyWidget base class."""

    _repr_mimebundle_: MimeBundleDescriptor

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        _register_anywidget_commands(self)
        # Access _repr_mimebundle_ descriptor to trigger comm initialization
        self._repr_mimebundle_  # noqa: B018

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Create the _repr_mimebundle_ descriptor and register anywidget commands."""
        super().__init_subclass__(**kwargs)
        extra_state = {
            key: getattr(cls, key) for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys()
        }
        cls._repr_mimebundle_ = MimeBundleDescriptor(**extra_state)
        _collect_anywidget_commands(cls)

    def send(self, msg: Any, buffers: list[memoryview] | None = None) -> None:
        """Send a message to the frontend."""
        self._repr_mimebundle_.send(content=msg, buffers=buffers)

    def on_msg(
        self, callback: Callable[[Any, str | list | dict, list[bytes]], None]
    ) -> None:
        """Register a message handler."""
        self._repr_mimebundle_.register_callback(callback)

