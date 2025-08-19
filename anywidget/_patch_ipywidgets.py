"""ipywidgets patch module.

Patches ipywidgets to allow for more flexible serialization and
deserialization of (any)widgets by allowing objects that are not
strict instances of `ipywidgets.Widget`.

Only `ipywidgets.Box` and `ipywidgets.widgets.widget_link.Link`
give problems. This code is mostly vendored from ipywidgets and
modified to allow for more flexibility.
"""

from __future__ import annotations

import typing as t

import ipywidgets
import traitlets
from ipywidgets import Widget

from ._descriptor import _COMMS

_IPYWIDGETS_INSTANCES = ipywidgets.widgets.widget._instances


def _get_model_id(x: t.Any) -> t.Any:
    """Get the model id of a widget or comm."""
    if isinstance(x, Widget):
        return x.model_id
    maybe_comm = _COMMS.get(id(x), None)
    return getattr(maybe_comm, "comm_id", None)


def _widget_to_json(x: t.Any, obj: t.Any) -> t.Any:
    """Recursively convert a widget to json."""
    if isinstance(x, dict):
        return {k: _widget_to_json(v, obj) for k, v in x.items()}
    elif isinstance(x, (list, tuple)):
        return [_widget_to_json(v, obj) for v in x]
    model_id = _get_model_id(x)
    return f"IPY_MODEL_{model_id}" if model_id else x


def _json_to_widget(x: t.Any, obj: t.Any) -> t.Any:
    """Recursively convert json to a widget."""
    if isinstance(x, dict):
        return {k: _json_to_widget(v, obj) for k, v in x.items()}
    elif isinstance(x, (list, tuple)):
        return [_json_to_widget(v, obj) for v in x]
    elif (
        isinstance(x, str)
        and x.startswith("IPY_MODEL_")
        and x[10:] in _IPYWIDGETS_INSTANCES
    ):
        return _IPYWIDGETS_INSTANCES[x[10:]]
    else:
        return x


class WidgetTrait(traitlets.TraitType):
    """Traitlet for validating things that can be (de)serialized into widgets."""

    # anything that can get a model id is ok as a widget
    def validate(self, obj: t.Any, value: t.Any) -> t.Any:
        if _get_model_id(value) is not None:
            return value
        else:
            self.error(obj, value)


# Adapted from https://github.com/jupyter-widgets/ipywidgets/blob/bb2edf78e7dac26e4b15522a267d7b477026a840/python/ipywidgets/ipywidgets/widgets/widget_link.py#L15
class WidgetTraitTuple(traitlets.Tuple):
    """Traitlet for validating a single (Widget, 'trait_name') pair."""

    info_text = "A (Widget, 'trait_name') pair"

    def __init__(self) -> None:
        super().__init__(WidgetTrait(), traitlets.Unicode())

    def validate_elements(self, obj: t.Any, value: t.Any) -> t.Any:
        value = super().validate_elements(obj, value)
        widget, trait_name = value
        trait = widget.traits().get(trait_name)
        trait_repr = f"{widget.__class__.__name__}.{trait_name}"
        # Can't raise TraitError because the parent will swallow the message
        # and throw it away in a new, less informative TraitError
        if trait is None:
            raise TypeError(f"No such trait: {trait_repr}")
        elif not trait.metadata.get("sync"):
            raise TypeError(f"{trait_repr} cannot be synced")
        return value


def _patch_ipywidgets() -> None:
    """Patch ipywidgets to allow for more flexible serialization and deserialization."""
    ipywidgets.Box.children.metadata["to_json"] = _widget_to_json
    ipywidgets.Box.children.metadata["from_json"] = _json_to_widget
    ipywidgets.Box.children.validate = ipywidgets.widgets.trait_types.TypedTuple(
        WidgetTrait()
    ).validate

    ipywidgets.widgets.widget_link.Link.source.metadata["to_json"] = _widget_to_json
    ipywidgets.widgets.widget_link.Link.source.metadata["from_json"] = _json_to_widget
    ipywidgets.widgets.widget_link.Link.source.validate_elements = (
        WidgetTraitTuple().validate_elements
    )

    ipywidgets.widgets.widget_link.Link.target.metadata["to_json"] = _widget_to_json
    ipywidgets.widgets.widget_link.Link.target.metadata["from_json"] = _json_to_widget
    ipywidgets.widgets.widget_link.Link.target.validate_elements = (
        WidgetTraitTuple().validate_elements
    )
