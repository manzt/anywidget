"""WidgetTrait type for widget composition."""

from __future__ import annotations

import traitlets.traitlets as t

from ._descriptor import _try_get_model_id

_REPR_ATTR = "_repr_mimebundle_"


class WidgetTrait(t.TraitType):
    """A trait that accepts anywidget-compatible objects.

    Validates that the value implements the anywidget protocol (has a
    ``MimeBundleDescriptor`` or ``ReprMimeBundle`` as ``_repr_mimebundle_``,
    or has a ``model_id`` attribute like ipywidgets).

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

    def validate(self, obj: object, value: object) -> object:
        if value is None:
            return value
        if _try_get_model_id(value) is not None:
            return value
        self.error(obj, value)  # ty: ignore[invalid-argument-type]
        return None
