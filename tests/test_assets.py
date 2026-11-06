from __future__ import annotations

import sys
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from anywidget._assets import try_file_contents
from anywidget._file_contents import FileContents

if TYPE_CHECKING:
    import pathlib


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
