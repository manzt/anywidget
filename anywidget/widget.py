import ipywidgets
import traitlets.traitlets as t

from ._version import __version__


class AnyWidget(ipywidgets.DOMWidget):
    _model_name = t.Unicode("AnyModel").tag(sync=True)
    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_module_version = t.Unicode(__version__).tag(sync=True)

    _view_name = t.Unicode("AnyView").tag(sync=True)
    _view_module = t.Unicode("anywidget").tag(sync=True)
    _view_module_version = t.Unicode(__version__).tag(sync=True)

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

        # TODO: a better way to uniquely identify this subclasses?
        # We use the fully-qualified name to get an id which we can use to update CSS if necessary.
        _anywidget_id = f"{self.__class__.__module__}.{self.__class__.__name__}"
        self.add_traits(_anywidget_id=t.Unicode(_anywidget_id).tag(sync=True))
