"""AnyWidget base class for custom Jupyter widgets."""

from __future__ import annotations

import ipywidgets
import traitlets.traitlets as t

from ._file_contents import FileContents, VirtualFileContents
from ._util import (
    _ANYWIDGET_ID_KEY,
    _CSS_KEY,
    _DEFAULT_ESM,
    _ESM_KEY,
    enable_custom_widget_manager_once,
    in_colab,
    repr_mimebundle,
    try_file_contents,
)
from ._version import _ANYWIDGET_SEMVER_VERSION
from .experimental import _collect_anywidget_commands, _register_anywidget_commands

_PLAIN_TEXT_MAX_LEN = 110


class AnyWidget(ipywidgets.DOMWidget):  # type: ignore [misc]
    """Main AnyWidget base class."""

    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(_ANYWIDGET_SEMVER_VERSION).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(_ANYWIDGET_SEMVER_VERSION).tag(sync=True)

    def __init__(self, *args: object, **kwargs: object) -> None:
        if in_colab():
            enable_custom_widget_manager_once()

        anywidget_traits = {}
        for key in (_ESM_KEY, _CSS_KEY):
            if hasattr(self, key) and not self.has_trait(key):
                value = getattr(self, key)
                anywidget_traits[key] = t.Unicode(str(value)).tag(sync=True)
                if isinstance(value, (VirtualFileContents, FileContents)):
                    value.changed.connect(
                        lambda new_contents, key=key: setattr(self, key, new_contents),
                    )

        # show default _esm if not defined
        if not hasattr(self, _ESM_KEY):
            anywidget_traits[_ESM_KEY] = t.Unicode(_DEFAULT_ESM).tag(sync=True)

        # TODO(manzt): a better way to uniquely identify this subclasses?  # noqa: TD003
        # We use the fully-qualified name to get an id which we
        # can use to update CSS if necessary.
        anywidget_traits[_ANYWIDGET_ID_KEY] = t.Unicode(
            f"{self.__class__.__module__}.{self.__class__.__name__}",
        ).tag(sync=True)

        self.add_traits(**anywidget_traits)
        super().__init__(*args, **kwargs)
        _register_anywidget_commands(self)

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Coerces _esm and _css to FileContents if they are files."""
        super().__init_subclass__(**kwargs)
        for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys():
            # TODO(manzt): Upgrate to := when we drop Python 3.7
            # https://github.com/manzt/anywidget/pull/167
            file_contents = try_file_contents(getattr(cls, key))
            if file_contents:
                setattr(cls, key, file_contents)
        _collect_anywidget_commands(cls)

    def _repr_mimebundle_(self, **kwargs: dict) -> tuple[dict, dict] | None:  # noqa: ARG002
        plaintext = repr(self)
        if len(plaintext) > _PLAIN_TEXT_MAX_LEN:
            plaintext = plaintext[:110] + "…"
        if self._view_name is None:
            return None  # type: ignore[unreachable]
        return repr_mimebundle(model_id=self.model_id, repr_text=plaintext)
