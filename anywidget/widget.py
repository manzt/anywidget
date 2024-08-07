"""AnyWidget base class for custom Jupyter widgets."""

from __future__ import annotations

import typing
from contextlib import contextmanager

import ipywidgets
import traitlets.traitlets as t

from ._static_asset import StaticAsset
from ._util import (
    _ANYWIDGET_ID_KEY,
    _CSS_KEY,
    _DEFAULT_ESM,
    _ESM_KEY,
    enable_custom_widget_manager_once,
    in_colab,
    repr_mimebundle,
)
from ._version import _ANYWIDGET_SEMVER_VERSION
from .experimental import _collect_anywidget_commands, _register_anywidget_commands


class AnyWidget(ipywidgets.DOMWidget):  # type: ignore [misc]
    """Main AnyWidget base class."""

    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(_ANYWIDGET_SEMVER_VERSION).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(_ANYWIDGET_SEMVER_VERSION).tag(sync=True)

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        if in_colab():
            enable_custom_widget_manager_once()

        self._anywidget_internal_state = {}
        for key in (_ESM_KEY, _CSS_KEY):
            if hasattr(self, key) and not self.has_trait(key):
                self._anywidget_internal_state[key] = getattr(self, key)

        if not hasattr(self, _ESM_KEY):
            self._anywidget_internal_state[_ESM_KEY] = _DEFAULT_ESM

        self._anywidget_internal_state[_ANYWIDGET_ID_KEY] = _id_for(self)

        with _patch_get_state(self, self._anywidget_internal_state):
            super().__init__(*args, **kwargs)

        _register_anywidget_commands(self)

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Coerces _esm and _css to FileContents if they are files."""
        super().__init_subclass__(**kwargs)
        for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys():
            # TODO: Upgrate to := when we drop Python 3.7
            value = getattr(cls, key)
            if not isinstance(value, StaticAsset):
                setattr(cls, key, StaticAsset(value))
        _collect_anywidget_commands(cls)

    def _repr_mimebundle_(self, **kwargs: dict) -> tuple[dict, dict] | None:
        plaintext = repr(self)
        if len(plaintext) > 110:
            plaintext = plaintext[:110] + "…"
        if self._view_name is None:
            return None  # type: ignore[unreachable]
        return repr_mimebundle(model_id=self.model_id, repr_text=plaintext)


def _id_for(obj: typing.Any) -> str:
    """Return a unique identifier for an object."""
    # TODO: a better way to uniquely identify this subclasses?
    # We use the fully-qualified name to get an id which we
    # can use to update CSS if necessary.
    return f"{obj.__class__.__module__}.{obj.__class__.__name__}"


@contextmanager
def _patch_get_state(
    widget: AnyWidget, extra_state: dict[str, str | StaticAsset]
) -> typing.Generator[None, None, None]:
    """Patch get_state to include anywidget-specific data."""
    original_get_state = widget.get_state

    def temp_get_state():
        return {
            **original_get_state(),
            **{
                k: v.serialize() if isinstance(v, StaticAsset) else v
                for k, v in extra_state.items()
            },
        }

    widget.get_state = temp_get_state
    try:
        yield
    finally:
        widget.get_state = original_get_state
