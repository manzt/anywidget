"""WidgetTrait type for widget composition."""

from __future__ import annotations

import traitlets.traitlets as t

from ._descriptor import _WIDGET_REF_PREFIX, _try_get_model_id


def _widget_to_json(value: object, _obj: object) -> object:
    """Serialize a WidgetTrait value to its wire form."""
    if value is None:
        return None
    model_id = _try_get_model_id(value)
    if model_id is None:
        return value
    return f"{_WIDGET_REF_PREFIX}{model_id}"


def _widget_from_json(value: object, _obj: object) -> object:
    """Pass-through for incoming state. JS sends the ref string as-is."""
    return value


class WidgetTrait(t.TraitType):
    """A trait that accepts anywidget-compatible objects.

    Validates that the value implements the anywidget protocol (has a
    ``MimeBundleDescriptor`` or ``ReprMimeBundle`` as ``_repr_mimebundle_``,
    or has a ``model_id`` attribute like ipywidgets). When synced, the value
    is serialized to the wire as ``"anywidget:<model_id>"``.

    .. note::
       Validation has no side effect for ``ipywidgets``-based widgets (their
       comms open in ``__init__``). For protocol-based widgets — those using
       ``MimeBundleDescriptor`` — validation opens the child's comm at
       assignment time instead of at display time. The difference is only
       observable if the parent is never displayed; otherwise the comm would
       open anyway.

    Examples
    --------
    >>> import anywidget
    >>> import traitlets
    >>>
    >>> class Dashboard(anywidget.AnyWidget):
    ...     _esm = "export default { render({ host }) {} }"
    ...     control = anywidget.WidgetTrait().tag(sync=True)
    """

    default_value = None
    info_text = "an anywidget-compatible object or None"
    allow_none = True

    def __init__(self) -> None:
        super().__init__()
        self.metadata.setdefault("to_json", _widget_to_json)
        self.metadata.setdefault("from_json", _widget_from_json)

    def validate(self, obj: object, value: object) -> object:
        if value is None:
            return value
        if _try_get_model_id(value) is not None:
            return value
        self.error(obj, value)  # ty: ignore[invalid-argument-type]
        return None
