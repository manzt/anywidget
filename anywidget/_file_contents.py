from __future__ import annotations

import pathlib
import threading
from collections import deque
from typing import Iterator

from psygnal import Signal


class FileContents:
    """Object that watches for file changes and emits a signal when it changes.

    Calling `str(obj)` on this object will always return the current contents of the
    file (as long as the thread is running).

    Parameters
    ----------
    path : str | pathlib.Path
        The file to read and watch for content changes
    start_thread : bool, optional
        Whether to start watching for changes in a separate thread (default: `True`)
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
        """Watch for file changes (and emitting signals) from a separate thread."""
        if self._background_thread is not None:
            return
        self._stop_event.clear()
        self._background_thread = threading.Thread(
            # self.watch() returns a generator, so the thread would exit
            # immediately if we passed `target=self.watch`. The `deque`
            # forces the thread to run until it exhausts our generator.
            target=lambda: deque(self.watch(), maxlen=0),
            daemon=True,
        )
        self._background_thread.start()

    def stop_thread(self) -> None:
        """Stops an actively running thread if it exists."""
        if self._background_thread is None:
            return
        self._stop_event.set()
        self._background_thread.join()
        self._background_thread = None

    def watch(self) -> Iterator[tuple[int, str]]:
        """Watch for file changes and emit changed/deleted signal events.

        Blocks indefinitely.

        Returns
        -------
        changes : Iterator[tuple[int, str]]
            An iterator that yields any time the file changes until the file is deleted.
        """
        try:
            from watchfiles import Change, watch
        except ImportError as exc:
            raise ImportError(
                "watchfiles is required to watch for file changes during development. "
                "Install with `pip install watchfiles`."
            ) from exc

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
            self._contents = self._path.read_text(encoding="utf-8")
        return self._contents
