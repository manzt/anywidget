"""Widget identity and reference serialization.

Shared by both kernel-side paths (``AnyWidget`` and ``MimeBundleDescriptor``).
"""

from __future__ import annotations

__all__ = [
    "_REPR_ATTR",
    "_WIDGET_REF_PREFIX",
    "_anywidget_id",
    "_replace_widget_refs",
    "_try_get_model_id",
]

_REPR_ATTR = "_repr_mimebundle_"
_WIDGET_REF_PREFIX = "anywidget:"


def _anywidget_id(obj: object) -> str:
    """Return a unique id for an object's class, to send to the JS side.

    The fully-qualified class name is used to key CSS in the front end.
    """
    # TODO(manzt): a better way to uniquely identify these subclasses?  # noqa: TD003
    return f"{type(obj).__module__}.{type(obj).__name__}"


def _try_get_model_id(obj: object) -> str | None:
    """Get model_id from an anywidget object, or None if not an anywidget.

    .. note::
       For protocol objects backed by a ``MimeBundleDescriptor`` (e.g.
       dataclasses), this forces the descriptor's ``__get__`` to run, which
       opens the object's comm. ``ipywidgets``-based widgets open their comm
       eagerly in ``__init__``, so the ``hasattr(obj, "model_id")`` branch
       short-circuits without side effects for them. The descriptor-driven
       side effect only matters if a protocol-based widget is assigned to a
       ``WidgetTrait`` (or otherwise inspected) and its parent is never
       displayed — otherwise the comm would have opened at display time
       anyway.
    """
    # ipywidgets-based AnyWidget has model_id directly
    if hasattr(obj, "model_id") and isinstance(obj.model_id, str):
        return obj.model_id
    # Protocol objects: access _repr_mimebundle_ to force comm creation.
    # Imported here because _descriptor imports this module.
    from ._descriptor import MimeBundleDescriptor, ReprMimeBundle  # noqa: PLC0415

    bundle = getattr(obj, _REPR_ATTR, None)
    if isinstance(bundle, MimeBundleDescriptor):
        # Force creation of ReprMimeBundle (and its comm)
        bundle = bundle.__get__(obj, type(obj))
    if isinstance(bundle, ReprMimeBundle):
        return bundle.model_id
    return None


def _replace_widget_refs(obj: dict) -> dict:
    """Recursively replace anywidget objects with 'anywidget:<model_id>' strings."""

    def _replace(v: object) -> object:
        model_id = _try_get_model_id(v)
        if model_id is not None:
            return f"{_WIDGET_REF_PREFIX}{model_id}"
        if isinstance(v, dict):
            return {k: _replace(val) for k, val in v.items()}
        if isinstance(v, list):
            return [_replace(item) for item in v]
        if isinstance(v, tuple):
            return tuple(_replace(item) for item in v)
        return v

    return {k: _replace(v) for k, v in obj.items()}
