import pathlib
import time
from collections import deque
from unittest.mock import MagicMock, Mock, patch

import pytest
import watchfiles
from anywidget._file_contents import FileContents
from watchfiles import Change


def test_file_contents_no_watch(tmp_path: pathlib.Path):
    """Test __str__ reads file contents and does not start a thread"""
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    path.write_text(CONTENTS)

    with patch.object(watchfiles, "watch") as mock:
        contents = FileContents(path, start_thread=False)
        assert str(contents) == CONTENTS
        assert contents._background_thread is None
    mock.assert_not_called()


def test_file_contents_deleted(tmp_path: pathlib.Path):
    """Test deleting a file emits a deleted signal and stops the watcher"""
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    path.write_text(CONTENTS)

    contents = FileContents(path, start_thread=False)
    mock = Mock()
    contents.deleted.connect(mock)

    def mock_file_events():
        changes = set()
        changes.add((Change.deleted, str(path)))
        yield changes
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        total = sum(1 for _ in contents.watch())

    assert total == 0
    mock_watch.assert_called_with(path, stop_event=contents._stop_event)
    assert mock.called


def test_file_contents_changed(tmp_path: pathlib.Path):
    """Test file changes emit changed signals and update the string contents"""
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    path.write_text(CONTENTS)
    contents = FileContents(path, start_thread=False)

    mock = MagicMock()
    contents.changed.connect(mock)

    NEW_CONTENTS = "blah"

    def mock_file_events():
        path.write_text(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        deque(contents.watch(), maxlen=0)

    mock.assert_called_with(NEW_CONTENTS)
    assert str(contents) == NEW_CONTENTS


def test_file_contents_thread(tmp_path: pathlib.Path):
    """Test runs watcher in background thread by default"""
    path = tmp_path / "foo.txt"
    path.touch()

    contents = FileContents(path)

    # thread on by default
    assert contents._background_thread
    assert not contents._stop_event.is_set()
    assert contents._background_thread.is_alive()

    # reuse the same thread
    thread = contents._background_thread
    contents.watch_in_thread()
    assert contents._background_thread == thread

    # stops the thread
    contents.stop_thread()
    assert contents._stop_event.is_set()
    assert contents._background_thread is None

    # no-op
    contents.stop_thread()


def test_background_file_contents(tmp_path: pathlib.Path):
    """Test background thread watcher sends signals and updates contents"""
    CONTENTS = "hello, world"
    path = tmp_path / "foo.txt"
    path.write_text(CONTENTS)

    contents = FileContents(path, start_thread=False)
    mock_changed = MagicMock()
    contents.changed.connect(mock_changed)

    mock_deleted = MagicMock()
    contents.deleted.connect(mock_deleted)

    NEW_CONTENTS = "blah"

    def mock_file_events():
        # write to file
        path.write_text(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))
        yield changes
        # delete the file
        changes = set()
        changes.add((Change.deleted, str(path)))
        yield changes
        # "re-create the file"
        path.write_text(NEW_CONTENTS)
        changes = set()
        changes.add((Change.modified, str(path)))

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        contents.watch_in_thread()

    while contents._background_thread and contents._background_thread.is_alive():
        time.sleep(0.01)

    mock_changed.assert_called_once_with(NEW_CONTENTS)
    assert str(contents) == NEW_CONTENTS


def test_missing_file_fails():
    """Test missing file fails to construct"""
    with pytest.raises(ValueError):
        FileContents("not_a_file.txt")

    with pytest.raises(ValueError):
        FileContents(pathlib.Path("not_a_file.txt"))
