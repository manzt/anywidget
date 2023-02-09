from collections import deque
import pathlib
from unittest.mock import MagicMock, Mock

import pytest
import watchfiles
from watchfiles import Change
import time

from anywidget._file_contents import FileContents


def test_file_contents_no_watch(
    monkeypatch: pytest.MonkeyPatch, tmp_path: pathlib.Path
):
    mock = MagicMock()
    monkeypatch.setattr(watchfiles, "watch", mock)

    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=False)

    assert str(contents) == CONTENTS
    assert contents._background_thread is None
    mock.assert_not_called


def test_file_contents_deleted(monkeypatch: pytest.MonkeyPatch, tmp_path: pathlib.Path):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    def mock_file_events():
        changes = set()
        changes.add((Change.deleted, str(path)))
        yield changes
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes

    mock_watch = MagicMock()
    mock_watch.return_value = mock_file_events()
    monkeypatch.setattr(watchfiles, "watch", mock_watch)

    contents = FileContents(path, start_thread=False)
    mock = Mock()
    contents.deleted.connect(mock)

    total = sum(1 for _ in contents.watch())
    assert total == 0
    mock_watch.assert_called_with(path, stop_event=contents._stop_event)
    assert mock.called


def test_file_contents_changed(monkeypatch: pytest.MonkeyPatch, tmp_path: pathlib.Path):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=False)

    NEW_CONTENTS = "blah"

    def mock_file_events():
        with open(path, mode="w") as f:
            f.write(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes

    mock_watch = MagicMock()
    mock_watch.return_value = mock_file_events()
    monkeypatch.setattr(watchfiles, "watch", mock_watch)

    mock = MagicMock()
    contents.changed.connect(mock)

    deque(contents.watch(), maxlen=0)

    mock.assert_called_with(NEW_CONTENTS)
    assert str(contents) == NEW_CONTENTS


def test_file_contents_thread(tmp_path: pathlib.Path):
    path = tmp_path / "foo.txt"
    path.touch()

    contents = FileContents(path)

    mock = Mock()
    contents.deleted.connect(mock)

    assert contents._background_thread
    assert not contents._stop_event.is_set()
    assert contents._background_thread.is_alive()

    contents.stop_thread()
    assert contents._stop_event.is_set()
    assert contents._background_thread is None


def test_background_file_contents(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: pathlib.Path,
):
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    with open(path, mode="w") as f:
        f.write(CONTENTS)

    contents = FileContents(path, start_thread=False)
    mock_changed = MagicMock()
    contents.changed.connect(mock_changed)

    mock_deleted = MagicMock()
    contents.deleted.connect(mock_deleted)

    NEW_CONTENTS = "blah"

    def mock_file_events():
        # write to file
        with open(path, mode="w") as f:
            f.write(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes
        # delete the file
        changes = set()
        changes.add((Change.deleted, str(path)))
        yield changes
        # "re-create the file"
        with open(path, mode="w") as f:
            f.write(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))

    mock_watch = MagicMock()
    mock_watch.return_value = mock_file_events()
    monkeypatch.setattr(watchfiles, "watch", mock_watch)

    contents.watch_in_thread()

    while contents._background_thread and contents._background_thread.is_alive():
        time.sleep(0.01)

    mock_changed.assert_called_once_with(NEW_CONTENTS)
    assert str(contents) == NEW_CONTENTS
    NEW_CONTENTS = "blah"


def test_missing_file_fails():
    with pytest.raises(ValueError):
        FileContents("not_a_file.txt")

    with pytest.raises(ValueError):
        FileContents(pathlib.Path("not_a_file.txt"))
