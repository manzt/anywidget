from __future__ import annotations

import ipywidgets
import pytest
import traitlets
from anywidget._patch_ipywidgets import (
    _AnyWidgetTrait,
    _AnyWidgetTraitTuple,
    _from_json,
    _to_json,
    patch_ipywidgets,
)


class FakeAnywidget(traitlets.HasTraits):
    """Stand-in for any object _try_get_model_id recognizes.

    Real protocol widgets work the same way (their MimeBundleDescriptor
    exposes a model_id), but constructing them in tests requires a comm
    fixture and weakref-cleanup gymnastics that aren't relevant here —
    the patch only cares whether _try_get_model_id returns a string.

    Inherits from HasTraits so traitlets.link's own validation (separate
    from anywidget's patch) accepts it as an endpoint.
    """

    value = traitlets.Int(0).tag(sync=True)

    def __init__(self, model_id: str = "abc") -> None:
        super().__init__()
        self.model_id = model_id


def test_patch_is_applied_on_import() -> None:
    # `import anywidget` runs patch_ipywidgets(); subsequent calls are no-ops.
    from anywidget._patch_ipywidgets import _PATCHED

    assert _PATCHED


def test_patch_is_idempotent() -> None:
    before = ipywidgets.Box.children.metadata["to_json"]
    patch_ipywidgets()
    patch_ipywidgets()
    assert ipywidgets.Box.children.metadata["to_json"] is before


def test_to_json_emits_ipy_model_prefix() -> None:
    assert _to_json(FakeAnywidget("abc"), None) == "IPY_MODEL_abc"


def test_to_json_recurses_into_lists_and_dicts() -> None:
    assert _to_json([FakeAnywidget("a"), 42], None) == ["IPY_MODEL_a", 42]
    assert _to_json({"k": FakeAnywidget("b")}, None) == {"k": "IPY_MODEL_b"}


def test_to_json_passthrough_for_plain_values() -> None:
    assert _to_json(42, None) == 42
    assert _to_json("hello", None) == "hello"


def test_from_json_passthrough_when_unknown() -> None:
    assert _from_json("IPY_MODEL_unknown", None) == "IPY_MODEL_unknown"
    assert _from_json("not-a-ref", None) == "not-a-ref"


def test_anywidget_trait_accepts_widgets() -> None:
    trait = _AnyWidgetTrait()
    assert trait.validate(None, FakeAnywidget()) is not None


def test_anywidget_trait_rejects_plain_objects() -> None:
    trait = _AnyWidgetTrait()
    with pytest.raises(traitlets.TraitError):
        trait.validate(traitlets.HasTraits(), object())


def test_anywidget_trait_tuple_validates_ipywidgets_trait_name() -> None:
    # For ipywidgets.Widget instances, we still verify the trait name exists
    # and is sync'd — that's the validation users rely on for link()/dlink().
    class W(ipywidgets.Widget):
        v = traitlets.Int(0).tag(sync=True)

    pair_trait = _AnyWidgetTraitTuple()
    holder = traitlets.HasTraits()
    w = W()
    pair_trait.validate_elements(holder, (w, "v"))

    with pytest.raises(TypeError, match="No such trait"):
        pair_trait.validate_elements(holder, (w, "nope"))


def test_anywidget_trait_tuple_skips_introspection_for_non_ipywidgets() -> None:
    # Non-ipywidgets objects don't expose .traits(); we trust the user.
    pair_trait = _AnyWidgetTraitTuple()
    pair_trait.validate_elements(traitlets.HasTraits(), (FakeAnywidget(), "anything"))


def test_hbox_accepts_anywidget_compatible() -> None:
    foo = FakeAnywidget()
    box = ipywidgets.HBox([foo])
    assert box.children == (foo,)


def test_hbox_serializes_children_with_ipy_prefix() -> None:
    foo = FakeAnywidget("abc123")
    box = ipywidgets.HBox([foo])
    serialize = ipywidgets.Box.children.metadata["to_json"]
    assert serialize(box.children, box) == ["IPY_MODEL_abc123"]


def test_hbox_still_rejects_plain_objects() -> None:
    with pytest.raises(traitlets.TraitError):
        ipywidgets.HBox([object()])


def test_link_accepts_anywidget_compatible() -> None:
    a = FakeAnywidget("a")
    b = FakeAnywidget("b")
    link = ipywidgets.link((a, "value"), (b, "value"))
    assert link.source[0] is a
    assert link.target[0] is b


def test_dlink_accepts_anywidget_compatible() -> None:
    a = FakeAnywidget("a")
    b = FakeAnywidget("b")
    dlink = ipywidgets.dlink((a, "value"), (b, "value"))
    assert dlink.source[0] is a
    assert dlink.target[0] is b
