"""AnyWidget base class for custom Jupyter widgets."""

from __future__ import annotations

import typing

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

if typing.TYPE_CHECKING:
    import pathlib


class _Asset(ipywidgets.Widget):
    data = t.Unicode().tag(sync=True)

    def __init__(self, data: str | pathlib.Path) -> None:
        file_contents = try_file_contents(data)
        super().__init__(data=str(file_contents) if file_contents else data)
        if file_contents:
            file_contents.changed.connect(
                lambda new_contents: setattr(self, "data", new_contents)
            )
        self._file_contents = file_contents

    def as_traittype(self) -> t.TraitType:
        return t.Instance(_Asset, default_value=self).tag(
            sync=True, to_json=lambda x, _: "anywidget-asset:" + x.model_id
        )


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

        anywidget_traits = {}
        for key in (_ESM_KEY, _CSS_KEY):
            if hasattr(self, key) and not self.has_trait(key):
                value = getattr(self, key)
                anywidget_traits[key] = t.Unicode(str(value)).tag(sync=True)
                if isinstance(value, (VirtualFileContents, FileContents)):
                    value.changed.connect(
                        lambda new_contents, key=key: setattr(self, key, new_contents)
                    )

        # show default _esm if not defined
        if not hasattr(self, _ESM_KEY):
            anywidget_traits[_ESM_KEY] = _Asset(data=_DEFAULT_ESM).as_traittype()

        # TODO: a better way to uniquely identify this subclasses?
        # We use the fully-qualified name to get an id which we
        # can use to update CSS if necessary.
        anywidget_traits[_ANYWIDGET_ID_KEY] = t.Unicode(
            f"{self.__class__.__module__}.{self.__class__.__name__}"
        ).tag(sync=True)

        self.add_traits(**anywidget_traits)
        super().__init__(*args, **kwargs)
        _register_anywidget_commands(self)

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Coerces _esm and _css to FileContents if they are files."""
        super().__init_subclass__(**kwargs)
        for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys():
            value = getattr(cls, key)
            if isinstance(value, t.TraitType):
                # we don't know how to handle this
                continue
            setattr(cls, key, _Asset(value))
        _collect_anywidget_commands(cls)

    def _repr_mimebundle_(self, **kwargs: dict) -> tuple[dict, dict] | None:
        plaintext = repr(self)
        if len(plaintext) > 110:
            plaintext = plaintext[:110] + "…"
        if self._view_name is None:
            return None  # type: ignore[unreachable]
        return repr_mimebundle(model_id=self.model_id, repr_text=plaintext)
