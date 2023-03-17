from __future__ import annotations

from ._version import __version__
from .widget import AnyWidget

__all__ = ["AnyWidget", "__version__"]


def _jupyter_labextension_paths() -> list[dict]:
    return [{"src": "labextension", "dest": "anywidget"}]


def _jupyter_nbextension_paths() -> list[dict]:
    return [
        {
            "section": "notebook",
            "src": "nbextension",
            "dest": "anywidget",
            "require": "anywidget/extension",
        }
    ]
