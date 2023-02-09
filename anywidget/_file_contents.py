from collections import deque

import pathlib
import threading
from typing import Iterator

from psygnal import Signal


class FileContents:
    """Object that watches a file for changes and emits a signal when it changes.

    Calling `str(obj)` on this object will always return the current contents of the
    file (as long as the thread is running).
    """

    changed = Signal(str)
    deleted = Signal()

    def __init__(self, path: str | pathlib.Path, start_thread: bool = True):
        self._path = pathlib.Path(path).expanduser().absolute()
        if not self._path.is_file():
            raise ValueError("File does not exist: {self._path}")
        self._contents: str | None = None  # cached contents, cleared on change
        self._stop_event = threading.Event()
        self._background_thread: threading.Thread | None = None
        if start_thread:
            self.watch_in_thread()

    def watch_in_thread(self) -> None:
        if self._background_thread is not None:
            return
        self._stop_event.clear()
        self._background_thread = threading.Thread(
            target=lambda: deque(self.watch(), maxlen=0),
            daemon=True,
        )
        self._background_thread.start()

    def stop_thread(self) -> None:
        if self._background_thread is None:
            return
        self._stop_event.set()
        self._background_thread.join()
        self._background_thread = None

    def watch(self) -> Iterator[tuple[int, str]]:
        from watchfiles import Change, watch

        for changes in watch(self._path, stop_event=self._stop_event):
            for change, path in changes:
                if change == Change.deleted:
                    self.deleted.emit()
                    return
                # Only getting Change.added events on macOS so we listen for either
                if change == Change.modified or change == Change.added:
                    self._contents = None
                    self.changed.emit(str(self))
                    yield (change, path)
                    break

    def __str__(self) -> str:
        if self._contents is None:
            self._contents = self._path.read_text()
        return self._contents
