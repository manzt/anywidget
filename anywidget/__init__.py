from ._version import __version__  # noqa
from .widget import AnyWidget  # noqa


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "anywidget"}]


def _jupyter_nbextension_paths():
    return [
        {
            "section": "notebook",
            "src": "nbextension",
            "dest": "anywidget",
            "require": "anywidget/extension",
        }
    ]
