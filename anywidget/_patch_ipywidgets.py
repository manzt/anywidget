"""Make ipywidgets.Box and ipywidgets.Link accept anywidget objects.

ipywidgets validates that ``Box.children`` and ``Link.{source,target}`` are
``ipywidgets.Widget`` instances. Protocol-based anywidgets (those using
``MimeBundleDescriptor`` rather than subclassing ``Widget``) get rejected.

This module relaxes those validators to accept anything ``_try_get_model_id``
recognizes, and wires up serializers that emit ``IPY_MODEL_<id>`` — the form
ipywidgets' JS side expects when reconstructing Box children and Link
endpoints.
"""

from __future__ import annotations

import typing as t

import ipywidgets
import traitlets
from ipywidgets.widgets.trait_types import TypedTuple
from ipywidgets.widgets.widget import _instances

from ._descriptor import _try_get_model_id


def _to_json(value: t.Any, _obj: t.Any) -> t.Any:
    if isinstance(value, dict):
        return {k: _to_json(v, _obj) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_json(v, _obj) for v in value]
    model_id = _try_get_model_id(value)
    return f"IPY_MODEL_{model_id}" if model_id is not None else value


def _from_json(value: t.Any, _obj: t.Any) -> t.Any:
    if isinstance(value, dict):
        return {k: _from_json(v, _obj) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_from_json(v, _obj) for v in value]
    if (
        isinstance(value, str)
        and value.startswith("IPY_MODEL_")
        and value[len("IPY_MODEL_") :] in _instances
    ):
        return _instances[value[len("IPY_MODEL_") :]]
    return value


class _AnyWidgetTrait(traitlets.TraitType):
    info_text = "an anywidget-compatible object"

    def validate(self, obj: t.Any, value: t.Any) -> t.Any:
        if _try_get_model_id(value) is not None:
            return value
        self.error(obj, value)
        return None


class _AnyWidgetTraitTuple(traitlets.Tuple):
    info_text = "a (Widget, 'trait_name') pair"

    def __init__(self) -> None:
        super().__init__(_AnyWidgetTrait(), traitlets.Unicode())

    def validate_elements(self, obj: t.Any, value: t.Any) -> t.Any:
        value = super().validate_elements(obj, value)
        widget, trait_name = value
        # Only ipywidgets.Widget instances expose .traits(). Protocol
        # widgets are trusted — their state surface isn't introspectable here.
        if isinstance(widget, ipywidgets.Widget):
            trait = widget.traits().get(trait_name)
            label = f"{widget.__class__.__name__}.{trait_name}"
            if trait is None:
                raise TypeError(f"No such trait: {label}")
            if not trait.metadata.get("sync"):
                raise TypeError(f"{label} cannot be synced")
        return value


_PATCHED = False


def patch_ipywidgets() -> None:
    """Relax Box.children and {Directional,}Link.{source,target} to accept anywidgets."""
    global _PATCHED  # noqa: PLW0603
    if _PATCHED:
        return

    children = ipywidgets.Box.children
    children.metadata["to_json"] = _to_json
    children.metadata["from_json"] = _from_json
    children.validate = TypedTuple(_AnyWidgetTrait()).validate

    link_module = ipywidgets.widgets.widget_link
    for endpoint in (
        link_module.Link.source,
        link_module.Link.target,
        link_module.DirectionalLink.source,
        link_module.DirectionalLink.target,
    ):
        endpoint.metadata["to_json"] = _to_json
        endpoint.metadata["from_json"] = _from_json
        endpoint.validate_elements = _AnyWidgetTraitTuple().validate_elements

    _PATCHED = True
