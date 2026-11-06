from __future__ import annotations

import gc
import json
import pathlib
import sys
import time
import weakref
from typing import TYPE_CHECKING, NoReturn
from unittest.mock import MagicMock, patch

import anywidget
import ipywidgets
import pytest
import traitlets.traitlets as t
import watchfiles
from anywidget import hosts
from anywidget._assets import _DEFAULT_ESM, asset_for
from anywidget._file_contents import FileContents
from anywidget._util import _WIDGET_MIME_TYPE
from anywidget.experimental import command
from traitlets import traitlets
from watchfiles import Change

if TYPE_CHECKING:
    from collections.abc import Generator

SELF_DIR = pathlib.Path(__file__).parent


def enable_hmr():  # noqa: ANN201
    return patch.dict("os.environ", {"ANYWIDGET_HMR": "1"}, clear=True)


def enable_shared_assets():  # noqa: ANN201
    return patch.dict("os.environ", {"ANYWIDGET_SHARED_ASSETS": "1"})


def test_version() -> None:
    with (SELF_DIR / "../packages/anywidget/package.json").open() as f:
        pkg = json.load(f)

    assert anywidget.__version__ == pkg["version"]


def test_basic() -> None:
    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(esm).tag(sync=True)

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm


def test_default_esm() -> None:
    class Widget(anywidget.AnyWidget): ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == _DEFAULT_ESM


def test_creates_fully_qualified_identifier() -> None:
    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _module = t.Unicode(esm).tag(sync=True)

    w = Widget()

    assert w.has_trait("_anywidget_id")
    assert w._anywidget_id == "test_widget.Widget"


def test_infer_traitlets() -> None:
    css = """
    .foo { background-color: black; }
    """

    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = esm
        _css = css

    w = Widget()

    assert w.has_trait("_esm")
    assert w.trait_metadata("_esm", "sync")

    assert w.has_trait("_css")
    assert w.trait_metadata("_css", "sync")


def test_infer_traitlets_partial() -> None:
    css = """
    .foo { background-color: black; }
    """

    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(esm).tag(foo="bar")
        _css = css

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm
    assert w.trait_metadata("_esm", "foo") == "bar"

    assert w.has_trait("_css")
    assert w._css == css
    assert w.trait_metadata("_css", "sync")


def test_patched_repr_ipywidget_v8() -> None:
    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert bundle, "No view"
    assert bundle[0]
    assert _WIDGET_MIME_TYPE in bundle[0]
    assert bundle[1] == {}


def test_patched_repr_ipywidget_v8_colab(monkeypatch: pytest.MonkeyPatch) -> None:
    mock = MagicMock()
    mock._widgets._installed_url = "foo"
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert bundle, "No view"
    assert bundle[0]
    assert _WIDGET_MIME_TYPE in bundle[0]
    assert bundle[1] == {
        _WIDGET_MIME_TYPE: {
            "colab": {"custom_widget_manager": {"url": mock._widgets._installed_url}},
        },
    }


def test_infer_file_contents(tmp_path: pathlib.Path) -> None:
    esm = tmp_path / "foo.js"
    esm.write_text(
        "export default { render({ model, el }) { el.innerText = 'Hello, world'; } }",
    )

    site_packages = tmp_path / "site-packages"
    site_packages.mkdir()
    css = site_packages / "styles.css"
    css.write_text(".foo { background-color: black; }")

    with enable_hmr():

        class Widget(anywidget.AnyWidget):
            _esm = esm
            _css = str(css)

    assert isinstance(Widget._esm, FileContents)
    assert Widget._esm._background_thread is not None

    assert isinstance(Widget._css, FileContents)
    assert Widget._css._background_thread is None

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm.read_text()

    assert w.has_trait("_css")
    assert w._css == css.read_text()

    def mock_file_events() -> Generator[set]:
        css.write_text("blah")
        # write to file
        changes = set()
        changes.add((Change.modified, str(css)))
        yield changes
        # delete the file
        changes = set()
        changes.add((Change.deleted, str(css)))
        yield changes

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        Widget._css.watch_in_thread()

    while Widget._css._background_thread and Widget._css._background_thread.is_alive():
        time.sleep(0.01)

    assert w._css == css.read_text()

    # need to teardown the thread for CI
    Widget._esm.stop_thread()


def test_missing_pathlib_path_raises(tmp_path: pathlib.Path) -> None:
    esm = tmp_path / "foo.js"

    with pytest.raises(FileNotFoundError):

        class Widget(anywidget.AnyWidget):
            _esm = esm


def test_missing_string_path_with_suffix_raises(tmp_path: pathlib.Path) -> None:
    str_path_with_suffix = str(tmp_path / "foo.js")

    with pytest.raises(FileNotFoundError):

        class Widget(anywidget.AnyWidget):
            _esm = str_path_with_suffix


def test_remote_contents() -> None:
    esm = "http://example.com/foo.js"
    css = "https://example.com/bar.css"

    class Widget(anywidget.AnyWidget):
        _esm = esm
        _css = css

    widget = Widget()
    assert widget._esm == esm
    assert widget._css == css


def test_missing_string_path_without_suffix_is_raw_string(
    tmp_path: pathlib.Path,
) -> None:
    str_path_without_suffix = str(tmp_path / "foo")

    class Widget(anywidget.AnyWidget):
        _esm = str_path_without_suffix

    assert Widget()._esm == str_path_without_suffix


def test_explicit_file_contents(tmp_path: pathlib.Path) -> None:
    path = tmp_path / "foo.js"
    path.write_text(
        "export default { render({ model, el }) { el.innerText = 'Hello, world'; } }",
    )
    esm = FileContents(path, start_thread=False)

    class Widget(anywidget.AnyWidget):
        _esm = esm

    assert Widget._esm == esm

    w = Widget()
    assert w._esm == path.read_text()


def test_dom_less_widget() -> None:
    class Widget(anywidget.AnyWidget):
        _view_name = traitlets.Any(None).tag(sync=True)
        _esm = """
        function render({ model, el }) {
            el.innerText = "Hello, world";
        }
        export default { render };
        """

    assert Widget()._repr_mimebundle_() is None


def test_command_not_registered_by_default() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = "export default { render(ctx) { ctx.el.innerText = 'Hello, world'; } }"

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 0


def test_anywidget_commands_register_one_callback() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = """
        export default {
            async render({ model, el, experimental }) {
                let [msg] = await experimental.invoke("_echo", "hi");
                let [msg] = await experimental.invoke("_echo2", "hi");
            }
        }
        """

        @command
        def _echo(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

        @command
        def _echo2(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 1


def test_supresses_error_in_constructor() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = """
        export default {
            async render({ model, el, experimental }) {
                let [msg] = await experimental.invoke("_echo", "hi");
            }
        }
        """

        @command
        def _echo(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

        @property
        def value(self) -> NoReturn:
            msg = "error"
            raise ValueError(msg)

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 1


def test_repr_uses_object_repr_by_default() -> None:
    """Test that __repr__ uses object.__repr__ to avoid expensive ipywidgets repr."""

    class Widget(anywidget.AnyWidget):
        # Create a large data trait that would be expensive to repr
        data = t.List([1, 2, 3, 4, 5] * 1000).tag(sync=True)

    w = Widget()
    result = repr(w)

    # Should use object.__repr__ format, NOT ipywidgets repr that serializes traits
    # ipywidgets repr would be: Widget(data=[1, 2, 3, ...])
    # object repr should be: <test_widget.Widget object at 0x...>
    assert result.startswith("<")
    assert "Widget object at 0x" in result
    assert result.endswith(">")
    # Ensure it doesn't contain the serialized data
    assert "data=" not in result


def test_repr_respects_custom_repr() -> None:
    """Test that custom __repr__ methods are respected."""

    class Widget(anywidget.AnyWidget):
        value = t.Int(42).tag(sync=True)

        def __repr__(self) -> str:
            return f"CustomWidget(value={self.value})"

    w = Widget()
    assert repr(w) == "CustomWidget(value=42)"


def test_widget_trait_accepts_anywidget() -> None:
    """Test that WidgetTrait accepts AnyWidget instances."""

    class Child(anywidget.AnyWidget):
        _esm = "export default { render() {} }"

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    child = Child()
    parent = Parent(child=child)
    assert parent.child is child


def test_widget_trait_accepts_none_by_default() -> None:
    """Test that WidgetTrait allows None by default."""

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    parent = Parent()
    assert parent.child is None


def test_widget_trait_rejects_non_widget() -> None:
    """Test that WidgetTrait rejects non-widget values."""

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    parent = Parent()
    with pytest.raises(t.TraitError):
        parent.child = "not a widget"

    with pytest.raises(t.TraitError):
        parent.child = 42


def test_widget_trait_rejects_assets() -> None:
    """An asset has a model id but is not a peer widget; `host.*` never gets one."""

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    with pytest.raises(t.TraitError):
        Parent(child=asset_for("export default {}"))


def test_widget_trait_accepts_protocol_object() -> None:
    """Test that WidgetTrait accepts protocol objects with model_id."""

    class FakeWidget:
        model_id = "fake-id"

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    parent = Parent()
    fake = FakeWidget()
    parent.child = fake
    assert parent.child is fake


def test_widget_trait_serializes_to_ref_string() -> None:
    """WidgetTrait values sync to the wire as 'anywidget:<model_id>' strings."""

    class Child(anywidget.AnyWidget):
        _esm = "export default { render() {} }"

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    child = Child()
    parent = Parent(child=child)
    state = parent.get_state(key=["child"])
    assert state == {"child": f"anywidget:{child.model_id}"}


def test_widget_trait_serializes_none() -> None:
    """A None-valued WidgetTrait passes through as None."""

    class Parent(anywidget.AnyWidget):
        _esm = "export default { render() {} }"
        child = anywidget.WidgetTrait().tag(sync=True)

    state = Parent().get_state(key=["child"])
    assert state == {"child": None}


def test_repr_mimebundle_uses_repr() -> None:
    """Test that _repr_mimebundle_ uses __repr__ for text/plain."""

    class Widget(anywidget.AnyWidget):
        def __repr__(self) -> str:
            return "MyCustomRepr"

    w = Widget()
    bundle = w._repr_mimebundle_()
    assert bundle is not None
    assert bundle[0]["text/plain"] == "MyCustomRepr"


def test_file_contents_widget_is_collectable(tmp_path: pathlib.Path) -> None:
    """A path-backed `_esm` must not keep instances alive (#929)."""
    esm = tmp_path / "widget.js"
    esm.write_text("export default { render() {} }")

    class Widget(anywidget.AnyWidget):
        _esm = esm

    assert isinstance(Widget._esm, FileContents)
    w = Widget()
    assert len(Widget._esm.changed) == 1

    ref = weakref.ref(w)
    w.close()  # ipywidgets keeps open widgets in a strong registry
    del w
    gc.collect()

    assert ref() is None
    assert len(Widget._esm.changed) == 0


def test_shared_assets_are_model_refs(tmp_path: pathlib.Path) -> None:
    esm = tmp_path / "widget.js"
    esm.write_text("export default { render() {} }")

    class Widget(anywidget.AnyWidget):
        _esm = esm
        _css = ".w {}"

    class Styled(Widget):
        _css = ".styled {}"

    with enable_shared_assets():
        a, b, styled = Widget(), Widget(), Styled()

    assert isinstance(Widget._esm, FileContents)
    esm_asset = asset_for(Widget._esm)
    assert a._esm is esm_asset
    assert b._esm is esm_asset
    assert styled._esm is esm_asset  # inherited module
    assert styled._css is not a._css  # overridden style
    assert str(a._esm) == esm.read_text()
    assert a.get_state()["_esm"] == f"anywidget-asset:{esm_asset.model_id}"
    assert a.get_state()["_css"] == f"anywidget-asset:{asset_for('.w {}').model_id}"
    # The asset holds the one subscription; instances add none.
    assert len(Widget._esm.changed) == 1


def test_shared_assets_default_esm_and_inline_override() -> None:
    class Widget(anywidget.AnyWidget):
        pass

    with enable_shared_assets():
        w = Widget()
        custom = Widget(_esm="export default { render() {} }")

    assert w._esm is asset_for(_DEFAULT_ESM)
    # An instance-level override is this instance's alone: inline, as when off.
    assert custom._esm == "export default { render() {} }"
    assert custom.get_state()["_esm"] == "export default { render() {} }"


def test_shared_assets_off_when_a_host_rebinds_comms_without_a_scope() -> None:
    """A shinywidgets-style host binds each comm to a session at construction.

    Without a scope, a process-wide asset would reach one session's front end
    and no other's, so the flag is ignored until the host names a scope.
    """

    class Widget(anywidget.AnyWidget):
        _esm = "export default { render() {} }"

    ipywidgets.Widget.on_widget_constructed(lambda _w: None)
    try:
        with enable_shared_assets():
            unscoped = Widget()
            hosts.configure(scope=lambda: None)
            scoped = Widget()
    finally:
        ipywidgets.Widget.on_widget_constructed(None)

    assert unscoped.get_state()["_esm"] == "export default { render() {} }"
    assert scoped.get_state()["_esm"] == f"anywidget-asset:{scoped._esm.model_id}"


def test_shared_assets_environment_wins_over_the_host_switch() -> None:
    """The variable is a kill switch: set, it beats the host either way."""

    class Widget(anywidget.AnyWidget):
        _esm = "export default { render() {} }"

    hosts.configure(shared_assets=True)
    with patch.dict("os.environ", {"ANYWIDGET_SHARED_ASSETS": "0"}):
        off = Widget()
    with patch.dict("os.environ", {}, clear=True):
        host_on = Widget()
    hosts.configure(shared_assets=False)
    with enable_shared_assets():
        on = Widget()

    assert off.get_state()["_esm"] == "export default { render() {} }"
    assert host_on.get_state()["_esm"].startswith("anywidget-asset:")
    assert on.get_state()["_esm"].startswith("anywidget-asset:")


def test_shared_assets_hot_reload_updates_the_asset_not_the_instances(
    tmp_path: pathlib.Path,
) -> None:
    esm = tmp_path / "widget.js"
    esm.write_text("v1")

    class Widget(anywidget.AnyWidget):
        _esm = esm

    with enable_shared_assets():
        w = Widget()
    before = w.get_state()["_esm"]

    assert isinstance(Widget._esm, FileContents)
    Widget._esm.changed.emit("v2")

    assert str(w._esm) == "v2"
    assert w.get_state()["_esm"] == before
