import sys
import ipywidgets
import traitlets.traitlets as t

from ._version import __version__

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


class AnyWidget(ipywidgets.DOMWidget):
    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(__version__).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(__version__).tag(sync=True)

    _enabled_colab_widget_manager = False

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

        # Add anywidget JS/CSS source as traits if not registered
        anywidget_traits = {
            k: t.Unicode(getattr(self, k)).tag(sync=True)
            for k in ("_esm", "_module", "_css")
            if hasattr(self, k) and not self.has_trait(k)
        }

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

        if "google.colab.output" in sys.modules:
            if not type(self)._enabled_colab_widget_manager:
                output = sys.modules.get("google.colab.output")
                output.enable_custom_widget_manager()  # type: ignore
                type(self)._enabled_colab_widget_manager = True

            # monkey-patch _ipython_display_ for Google Colab
            # see https://github.com/manzt/anywidget/issues/48
            if not hasattr(self, "_ipython_display_"):

                def _ipython_display_(**kwargs):
                    from IPython.display import display

                    data = self._repr_mimebundle_(**kwargs)
                    display(data, raw=True)

                self._ipython_display_ = _ipython_display_
