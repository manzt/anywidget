from __future__ import annotations

import gc
import sys
import weakref
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import ipywidgets
import pytest
import traitlets.traitlets as t
from anywidget import hosts
from anywidget._assets import _CACHES, AssetTrait, asset_for, try_file_contents
from anywidget._descriptor import _replace_widget_refs
from anywidget._file_contents import FileContents, VirtualFileContents

if TYPE_CHECKING:
    import pathlib
    from collections.abc import Generator


def enable_hmr():  # noqa: ANN201
    return patch.dict("os.environ", {"ANYWIDGET_HMR": "1"}, clear=True)


def test_try_file_contents_development(tmp_path: pathlib.Path) -> None:
    foo = tmp_path / "foo.txt"

    with pytest.raises(FileNotFoundError):
        try_file_contents(foo)

    foo.write_text("foo")
    assert try_file_contents(foo) is not None


def test_try_file_contents_development_enable_hmr(tmp_path: pathlib.Path) -> None:
    foo = tmp_path / "foo.txt"

    with pytest.raises(FileNotFoundError):
        try_file_contents(foo)

    foo.write_text("foo")
    with enable_hmr():
        file_contents = try_file_contents(foo)
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is not None
    file_contents.stop_thread()  # stop the background thread for CI


def test_try_file_contents_production(tmp_path: pathlib.Path) -> None:
    site_packages = tmp_path / "site-packages"
    site_packages.mkdir()
    bar = site_packages / "bar.txt"
    bar.write_text("bar")

    file_contents = try_file_contents(bar)
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is None


def test_try_file_contents_google_colab(tmp_path: pathlib.Path) -> None:
    site_packages = tmp_path / "dist-packages"
    site_packages.mkdir()
    bar = site_packages / "bar.txt"
    bar.write_text("bar")

    file_contents = try_file_contents(bar)
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is None


def test_try_file_contents_warns(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: pathlib.Path,
) -> None:
    monkeypatch.setitem(sys.modules, "watchfiles", None)
    foo = tmp_path / "foo.txt"
    foo.write_text("foo")

    with enable_hmr():
        with pytest.warns(UserWarning, match="anywidget:"):
            file_contents = try_file_contents(foo)

        assert isinstance(file_contents, FileContents)
        assert file_contents._background_thread is None


class MockComm(MagicMock):
    """Records the open message and relays front-end messages to the widget."""

    _count = 0
    msg_callback = None

    def __init__(self, **open_kwargs: object) -> None:
        super().__init__()
        MockComm._count += 1
        self.comm_id = open_kwargs.get("comm_id", f"mock-comm-{MockComm._count}")
        self.open_kwargs = open_kwargs

    def on_msg(self, cb: object) -> None:
        self.msg_callback = cb

    def handle_msg(self, msg: object) -> None:
        if self.msg_callback is not None:
            self.msg_callback(msg)


@pytest.fixture
def comms() -> Generator[list[MockComm]]:
    """Every comm opened while the test runs, in order."""
    created: list[MockComm] = []

    def create_comm(**kwargs: object) -> MockComm:
        comm = MockComm(**kwargs)
        created.append(comm)
        return comm

    with patch("comm.create_comm", side_effect=create_comm):
        yield created


def test_asset_for_shares_one_asset_per_value(
    comms: list[MockComm], tmp_path: pathlib.Path
) -> None:
    esm = tmp_path / "widget.js"
    esm.write_text("export default {}")
    file_contents = FileContents(esm, start_thread=False)
    virtual = VirtualFileContents("export default {}")

    assert asset_for(file_contents) is asset_for(file_contents)
    assert asset_for(virtual) is asset_for(virtual)
    assert asset_for("inline") is asset_for("inline")
    assert asset_for("inline") is not asset_for("other")
    assert asset_for(asset_for("inline")) is asset_for("inline")
    assert [c.open_kwargs["data"]["state"]["contents"] for c in comms] == [  # type: ignore[index]
        "export default {}",
        "export default {}",
        "inline",
        "other",
    ]


def test_asset_for_accepts_only_sources(tmp_path: pathlib.Path) -> None:
    """Paths are coerced at class definition; an asset is made from source."""
    with pytest.raises(TypeError):
        asset_for(42)
    with pytest.raises(TypeError):
        asset_for(tmp_path / "widget.js")


def test_asset_opens_one_comm_carrying_contents(comms: list[MockComm]) -> None:
    asset = asset_for("export default {}")

    assert len(comms) == 1
    state = comms[0].open_kwargs["data"]["state"]  # type: ignore[index]
    assert state["_model_module"] == "anywidget"
    assert state["_model_name"] == "AnyAssetModel"
    assert state["_view_name"] is None
    assert state["contents"] == "export default {}"
    assert asset.model_id == comms[0].comm_id
    assert str(asset) == "export default {}"


def test_asset_forwards_a_source_change_as_one_update(comms: list[MockComm]) -> None:
    virtual = VirtualFileContents("v1")
    asset = asset_for(virtual)
    comms[0].send.reset_mock()

    virtual.contents = "v2"

    assert str(asset) == "v2"
    comms[0].send.assert_called_once()
    data = comms[0].send.call_args.kwargs["data"]
    assert data["method"] == "update"
    assert data["state"] == {"contents": "v2"}


def test_asset_answers_request_state(comms: list[MockComm]) -> None:
    asset_for("src")
    comm = comms[0]
    comm.send.reset_mock()

    comm.handle_msg({"content": {"data": {"method": "request_state"}}, "buffers": []})

    data = comm.send.call_args.kwargs["data"]
    assert data["method"] == "update"
    assert data["state"]["contents"] == "src"


def test_asset_ignores_client_writes(comms: list[MockComm]) -> None:
    asset = asset_for("src")
    comm = comms[0]
    comm.send.reset_mock()

    comm.handle_msg(
        {
            "content": {
                "data": {
                    "method": "update",
                    "state": {"contents": "evil"},
                    "buffer_paths": [],
                }
            },
            "buffers": [],
        }
    )

    assert str(asset) == "src"
    for call in comm.send.call_args_list:
        assert "contents" not in call.kwargs["data"].get("state", {})


def test_closed_asset_is_replaced_not_reopened(comms: list[MockComm]) -> None:
    """The replacement goes through `Widget.__init__`, so host hooks see it."""
    virtual = VirtualFileContents("src")
    first = asset_for(virtual)
    first_id = first.model_id
    assert len(virtual.changed) == 1

    ipywidgets.Widget.close_all()
    assert first.comm is None
    # Closing stops following the source.
    assert len(virtual.changed) == 0

    second = asset_for(virtual)
    assert second is not first
    assert second.comm is not None
    assert second.model_id != first_id
    assert len(virtual.changed) == 1
    assert [c.comm_id for c in comms] == [first_id, second.model_id]


def test_assets_are_scoped(comms: list[MockComm]) -> None:
    """A host with several front ends in one process gets one asset per scope."""

    class Session:
        pass

    a, b = Session(), Session()
    current: Session | None = a
    hosts.configure(scope=lambda: current)

    in_a = asset_for("src")
    assert asset_for("src") is in_a
    current = b
    in_b = asset_for("src")
    assert in_b is not in_a
    assert [c.comm_id for c in comms] == [in_a.model_id, in_b.model_id]

    # No current scope means the process-wide cache, which is a third one.
    current = None
    assert asset_for("src") not in (in_a, in_b)


def test_asset_scope_must_be_weakrefable() -> None:
    hosts.configure(scope=lambda: 1)
    with pytest.raises(TypeError, match="scope"):
        asset_for("src")


@pytest.mark.usefixtures("comms")
def test_asset_cache_dies_with_its_scope() -> None:
    class Session:
        pass

    holder: list[Session | None] = [Session()]
    ref = weakref.ref(holder[0])  # type: ignore[arg-type]
    hosts.configure(scope=lambda: holder[0])
    asset_for("src")
    assert len(_CACHES) == 1

    holder[0] = None
    gc.collect()

    assert ref() is None
    assert len(_CACHES) == 0


@pytest.mark.usefixtures("comms")
def test_asset_trait_shares_the_default_and_keeps_overrides_inline() -> None:
    class Host(ipywidgets.Widget):  # type: ignore[misc]
        _esm = AssetTrait(default_value="default source").tag(sync=True)

    default = asset_for("default source")
    host = Host()
    assert host._esm is default
    assert host.get_state()["_esm"] == f"anywidget-asset:{default.model_id}"

    # An instance-level value is this instance's alone: inline, not interned.
    inline = Host(_esm="other source")
    assert inline._esm == "other source"
    assert inline.get_state()["_esm"] == "other source"
    assert all("other source" not in cache for cache in _CACHES.values())

    explicit = Host(_esm=asset_for("explicit source"))
    assert explicit.get_state()["_esm"] == f"anywidget-asset:{explicit._esm.model_id}"

    with pytest.raises(t.TraitError):
        Host(_esm=42)

    comm = host.comm
    comm.send.reset_mock()
    host.set_state({"_esm": "anywidget-asset:from-a-client"})
    assert host._esm is default
    for call in comm.send.call_args_list:
        assert "_esm" not in call.kwargs["data"].get("state", {})


@pytest.mark.usefixtures("comms")
def test_asset_trait_rejects_inline_source_after_construction() -> None:
    """The front end reads the asset once the widget exists; a later string
    would never reach it, so the swap is refused rather than silently ignored.
    """

    class Host(ipywidgets.Widget):  # type: ignore[misc]
        _esm = AssetTrait(default_value="default source").tag(sync=True)

    host = Host()
    with pytest.raises(t.TraitError, match="shared asset"):
        host._esm = "inline source"
    assert host._esm is asset_for("default source")

    # Swapping one asset for another is allowed, and so is an inline override
    # at construction, which is this instance's alone.
    host._esm = asset_for("other source")
    assert Host(_esm="inline source")._esm == "inline source"


@pytest.mark.usefixtures("comms")
def test_replace_widget_refs_serializes_assets_as_model_refs() -> None:
    asset = asset_for("src")
    assert _replace_widget_refs({"_esm": asset, "n": 1}) == {
        "_esm": f"anywidget-asset:{asset.model_id}",
        "n": 1,
    }
