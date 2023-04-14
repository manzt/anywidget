from __future__ import annotations

from typing import Any

import ipywidgets
import traitlets.traitlets as t

from ._file_contents import FileContents
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


class AnyWidget(ipywidgets.DOMWidget):  # type: ignore [misc]
    """Main AnyWidget base class."""

    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(__version__).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(__version__).tag(sync=True)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        # Add anywidget JS/CSS source as traits if not registered
        anywidget_traits = {}

        for key in (_ESM_KEY, _CSS_KEY):
            if hasattr(self, key) and not self.has_trait(key):
                value = getattr(self, key)
                anywidget_traits[key] = t.Unicode(str(value)).tag(sync=True)

                if isinstance(value, FileContents):
                    value.changed.connect(
                        lambda new_contents, key=key: setattr(self, key, new_contents)
                    )

        # show default _esm if not defined
        if not hasattr(self, _ESM_KEY):
            anywidget_traits[_ESM_KEY] = t.Unicode(_DEFAULT_ESM).tag(sync=True)

        # TODO: a better way to uniquely identify this subclasses?
        # We use the fully-qualified name to get an id which we
        # can use to update CSS if necessary.
        anywidget_traits[_ANYWIDGET_ID_KEY] = t.Unicode(
            f"{self.__class__.__module__}.{self.__class__.__name__}"
        ).tag(sync=True)

        self.add_traits(**anywidget_traits)

        if in_colab():
            enable_custom_widget_manager_once()

    def __init_subclass__(cls, **kwargs: dict) -> None:
        """Coerces _esm and _css to FileContents if they are files."""
        super().__init_subclass__(**kwargs)
        for key in (_ESM_KEY, _CSS_KEY) & cls.__dict__.keys():
            # TODO: Upgrate to := when we drop Python 3.7
            file_contents = try_file_contents(getattr(cls, key))
            if file_contents:
                setattr(cls, key, file_contents)

    if hasattr(ipywidgets.DOMWidget, "_repr_mimebundle_"):
        # ipywidgets v8
        def _repr_mimebundle_(self, **kwargs: dict) -> tuple[None | dict, dict]:
            return super()._repr_mimebundle_(**kwargs), get_repr_metadata()
