from __future__ import annotations

import pathlib
from typing import Any

import ipywidgets
import traitlets.traitlets as t

from ._util import (
    _ANYWIDGET_ID_KEY,
    _CSS_KEY,
    _DEFAULT_ESM,
    _ESM_KEY,
    enable_custom_widget_manager_once,
    get_repr_metadata,
    in_colab,
    try_file_contents,
)
from ._version import __version__


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
    _model_module_version = t.Unicode(__version__).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(__version__).tag(sync=True)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        if in_colab():
            enable_custom_widget_manager_once()

        anywidget_traits = {}
        for key in (_ESM_KEY, _CSS_KEY):
            if hasattr(self, key) and not self.has_trait(key):
                value = getattr(self, key)
                anywidget_traits[key] = value.as_traittype()

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

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Coerces _esm and _css to FileContents if they are files."""
        super().__init_subclass__(**kwargs)
        for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys():
            value = getattr(cls, key)
            if isinstance(value, t.TraitType):
                # we don't know how to handle this
                continue
            setattr(cls, key, _Asset(value))

    if hasattr(ipywidgets.DOMWidget, "_repr_mimebundle_"):
        # ipywidgets v8
        def _repr_mimebundle_(self, **kwargs: dict) -> tuple[dict, dict] | None:
            mimebundle = super()._repr_mimebundle_(**kwargs)
            if mimebundle is None:
                return None
            return mimebundle, get_repr_metadata()
