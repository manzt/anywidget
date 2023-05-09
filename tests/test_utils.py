import pathlib
import sys
from unittest.mock import MagicMock

import pytest
from anywidget._file_contents import FileContents
from anywidget._util import (
    get_repr_metadata,
    put_buffers,
    remove_buffers,
    try_file_contents,
)


def test_remove_and_put_buffers():
    mv1 = memoryview(b"test1")
    mv2 = memoryview(b"test2")
    state = {
        "plain": [0, "text"],  # should not get removed
        "x": {"ar": mv1},  # should result in an empty dict
        "y": {"shape": (10, 10), "data": mv1},
        "z": (mv1, mv2),  # tests tuple assignment
        "top": mv1,  # test a top level removal
        "deep": {"a": 1, "b": [0, {"deeper": mv2}]},
    }  # deeply nested
    plain = state["plain"]
    x = state["x"]
    y = state["y"]
    y_shape = y["shape"]
    state_before = state
    state, buffer_paths, buffers = remove_buffers(state)

    # check if buffers are removed
    assert "plain" in state
    assert "shape" in state["y"]
    assert "ar" not in state["x"]
    assert state["x"] == {}
    assert "data" not in state["y"]
    assert mv1 not in state["z"]
    assert mv1 not in state["z"]
    assert "top" not in state
    assert "deep" in state
    assert "b" in state["deep"]
    assert "deeper" not in state["deep"]["b"][1]

    # check that items that didn't need change aren't touched
    assert state is not state_before
    assert state["plain"] is plain
    assert state["x"] is not x
    assert state["y"] is not y
    assert state["y"]["shape"] is y_shape

    # check that the buffer paths really point to the right buffer
    for path, buffer in [
        (["x", "ar"], mv1),
        (["y", "data"], mv1),
        (["z", 0], mv1),
        (["z", 1], mv2),
        (["top"], mv1),
        (["deep", "b", 1, "deeper"], mv2),
    ]:
        assert path in buffer_paths, f"{path!r} not in path"
        index = buffer_paths.index(path)
        assert buffer == buffers[index]

    # and check that we can put it back together again
    put_buffers(state, buffer_paths, buffers)
    # we know that tuples get converted to list, so help the comparison by changing the
    # tuple to a list
    state_before["z"] = list(state_before["z"])
    assert state_before == state


def test_enables_widget_manager_in_colab(monkeypatch: pytest.MonkeyPatch):
    mock = MagicMock()
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)
    get_repr_metadata()
    get_repr_metadata()
    assert mock.enable_custom_widget_manager.assert_called_once


def test_get_metadata(monkeypatch: pytest.MonkeyPatch):
    meta = get_repr_metadata()
    assert meta == {}

    mock = MagicMock()
    mock._widgets._installed_url = None
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)
    meta = get_repr_metadata()
    assert meta == {}

    mock = MagicMock()
    mock._widgets._installed_url = "foo"
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)
    meta = get_repr_metadata()
    assert meta == {
        "application/vnd.jupyter.widget-view+json": {
            "colab": {"custom_widget_manager": {"url": "foo"}}
        }
    }


def test_try_file_contents(tmp_path: pathlib.Path):
    foo = tmp_path / "foo.txt"

    assert try_file_contents(foo) is None

    foo.write_text("foo")

    file_contents = try_file_contents(foo)
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is not None
    file_contents.stop_thread()  # stop the background thread for CI

    site_packages = tmp_path / "site-packages"
    site_packages.mkdir()
    bar = site_packages / "bar.txt"
    bar.write_text("bar")

    file_contents = try_file_contents(bar)
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is None


def test_try_file_contents_warns(
    monkeypatch: pytest.MonkeyPatch, tmp_path: pathlib.Path
):
    monkeypatch.setitem(sys.modules, "watchfiles", None)

    foo = tmp_path / "foo.txt"
    foo.write_text("foo")

    with pytest.warns(UserWarning, match="anywidget:"):
        file_contents = try_file_contents(foo)

    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is None
