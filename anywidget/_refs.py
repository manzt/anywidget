"""Widget identity and reference prefixes.

Shared by both kernel-side paths (``AnyWidget`` and ``MimeBundleDescriptor``).
This module has no anywidget imports so that anything may depend on it.
"""

from __future__ import annotations

__all__ = [
    "_REPR_ATTR",
    "_WIDGET_REF_PREFIX",
    "_anywidget_id",
]

_REPR_ATTR = "_repr_mimebundle_"
# A widget reference names a peer model; authors resolve it through `host`.
_WIDGET_REF_PREFIX = "anywidget:"


def _anywidget_id(obj: object) -> str:
    """Return a unique id for an object's class, to send to the JS side.

    The fully-qualified class name is used to key CSS in the front end.
    """
    # TODO(manzt): a better way to uniquely identify these subclasses?  # noqa: TD003
    return f"{type(obj).__module__}.{type(obj).__name__}"
