from __future__ import annotations

from typing import Any

import ipywidgets
import traitlets.traitlets as t

from ._util import (
    enable_custom_widget_manager_once,
    get_repr_metadata,
    in_colab,
)
from ._version import __version__

_ANYWIDGET_ID_KEY = "_anywidget_id"
_ESM_KEY = "_esm"
_CSS_KEY = "_css"
DEFAULT_ESM = """
export function render(view) {
  console.log("Dev note: No _esm defined for this widget:", view);
  let url = "https://anywidget.dev/en/getting-started/";
  view.el.innerHTML = `<p>
    <strong>Dev note</strong>:
    <a href='${url}' target='blank'>Implement an <code>_esm</code> attribute</a>
    on AnyWidget subclass <code>${view.model.get('_anywidget_id')}</code>
    to customize this widget.
  </p>`;
}
"""


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
        anywidget_traits = {
            k: t.Unicode(getattr(self, k)).tag(sync=True)
            for k in (_ESM_KEY, _CSS_KEY)
            if hasattr(self, k) and not self.has_trait(k)
        }

        # show default _esm if not defined
        if not hasattr(self, _ESM_KEY):
            anywidget_traits[_ESM_KEY] = t.Unicode(DEFAULT_ESM).tag(sync=True)

        # TODO: a better way to uniquely identify this subclasses?
        # We use the fully-qualified name to get an id which we
        # can use to update CSS if necessary.
        anywidget_traits[_ANYWIDGET_ID_KEY] = t.Unicode(
            f"{self.__class__.__module__}.{self.__class__.__name__}"
        ).tag(sync=True)

        self.add_traits(**anywidget_traits)

        if in_colab():
            enable_custom_widget_manager_once()

    if hasattr(ipywidgets.DOMWidget, "_repr_mimebundle_"):
        # ipywidgets v8
        def _repr_mimebundle_(self, **kwargs: dict) -> tuple[None | dict, dict]:
            return super()._repr_mimebundle_(**kwargs), get_repr_metadata()
