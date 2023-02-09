import pathlib
import time
from typing import Callable
from unittest.mock import MagicMock, Mock

import pytest

from anywidget._file_contents import FileContents


def wait_until(condition: Callable, interval: float = 0.1, timeout: float = 4, *args):
    start = time.time()
    while not condition(*args) and time.time() - start < timeout:
        time.sleep(interval)


def test_file_contents_no_watch(tmp_path: pathlib.Path):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=False)

    assert str(contents) == CONTENTS
    assert contents._background_thread is None

    with open(path, mode="a") as f:
        f.write("appended")

    time.sleep(0.5)
    assert str(contents) == CONTENTS


def test_file_contents_deleted(tmp_path: pathlib.Path):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=True)

    mock = Mock()
    contents.deleted.connect(mock)

    assert contents._background_thread
    assert contents._background_thread.is_alive()

    # Make sure we've waited long enough that our thread
    # will listen to the event below
    time.sleep(1)

    path.unlink()

    # should kill our thread
    wait_until(
        lambda: contents._background_thread
        and not contents._background_thread.is_alive()
    )

    assert mock.called


def test_file_contents_changed(tmp_path: pathlib.Path):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=True)

    mock = MagicMock()
    contents.changed.connect(mock)

    assert contents._background_thread
    assert contents._background_thread.is_alive()

    # Make sure we've waited long enough that our thread
    # will listen to the event below
    time.sleep(1)

    NEW_CONTENTS = "HELLO, WOLRD"
    with open(path, mode="w") as f:
        f.write(NEW_CONTENTS)

    # called once with orginal content and then
    # last call with latest
    wait_until(lambda: mock.call_count == 2)

    mock.assert_called_with(NEW_CONTENTS)


def test_missing_file_fails():
    with pytest.raises(ValueError):
        FileContents("not_a_file.txt")

    with pytest.raises(ValueError):
        FileContents(pathlib.Path("not_a_file.txt"))
