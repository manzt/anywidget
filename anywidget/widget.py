import sys
from functools import lru_cache

import ipywidgets
import traitlets.traitlets as t

from ._version import __version__
from ._file_contents import FileContents
from ._util import is_existing_file

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


@lru_cache(maxsize=None)
def _enable_custom_widget_manager():
    # Enable custom widgets manager so that our widgets display in Colab
    # https://github.com/googlecolab/colabtools/issues/498#issuecomment-998308485
    sys.modules["google.colab.output"].enable_custom_widget_manager()  # type: ignore


class AnyWidget(ipywidgets.DOMWidget):
    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(__version__).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(__version__).tag(sync=True)

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

        # Add anywidget JS/CSS source as traits if not registered
        anywidget_traits = {}

        for key in ("_esm", "_module", "_css"):
            # ignore explicit traits
            if not hasattr(self, key) or self.has_trait(key):
                continue

            value = getattr(self, key)

            if isinstance(value, FileContents):
                value.changed.connect(lambda _: self.send_state(key))

            anywidget_traits[key] = t.Any(value).tag(
                sync=True,
                to_json=lambda x, _: str(x),
            )

        # show default _esm if not defined
        if all(not hasattr(self, i) for i in ("_esm", "_module")):
            anywidget_traits["_esm"] = t.Unicode(DEFAULT_ESM).tag(sync=True)

        # TODO: a better way to uniquely identify this subclasses?
        # We use the fully-qualified name to get an id which we
        # can use to update CSS if necessary.
        anywidget_traits["_anywidget_id"] = t.Unicode(
            f"{self.__class__.__module__}.{self.__class__.__name__}"
        ).tag(sync=True)

        self.add_traits(**anywidget_traits)

        # Check if we are in Colab
        if "google.colab.output" in sys.modules:
            _enable_custom_widget_manager()

            # Monkey-patch _ipython_display_ for each instance if missing.
            # Necessary for Colab to display third-party widget
            # see https://github.com/manzt/anywidget/issues/48
            if not hasattr(self, "_ipython_display_"):

                def _ipython_display_(**kwargs):
                    from IPython.display import display

                    data = self._repr_mimebundle_(**kwargs)
                    display(data, raw=True)

                self._ipython_display_ = _ipython_display_
