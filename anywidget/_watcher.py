from __future__ import annotations

import pathlib
import threading
from typing import Callable

FileChangeHandler = Callable[[str], None]


class LiveWatcher:
    _background_thread: threading.Thread | None = None
    _stop_event: None | threading.Event = None

    def __init__(self):
        self._handlers: dict[pathlib.Path, set[FileChangeHandler]] = {}
        self._watching: set[pathlib.Path] = set()

    def watch(self, file: str | pathlib.Path, handler: FileChangeHandler):
        file = pathlib.Path(file).absolute()
        assert file.is_file(), "Can only add individual files to watch"

        if file not in self._handlers:
            self._handlers[file] = set()

        self._handlers[file].add(handler)

        # Our background thread watches directories for changes, so we
        # consolidate all file parents (directories) that we need to watch.
        should_be_watching = set(p.parent for p in self._handlers.keys())

        # No need to teardown/restart a thread if we are already watching
        # the right directories.
        if self._watching != should_be_watching:
            self._stop_background_thread()

        # (Re)start the watcher thread if we don't have one
        if self._background_thread is None:
            self._start_background_thread()

        return self

    def unwatch(self, file: str | pathlib.Path, handler: FileChangeHandler):
        file = pathlib.Path(file).absolute()

        # Remove the handler
        self._handlers[file].remove(handler)

        # Return if we still have listeners for this file
        if len(self._handlers[file]) > 0:
            return self

        # Clean up the file and check what we should be watching
        self._handlers.pop(file)
        should_be_watching = set(p.parent for p in self._handlers.keys())

        # No need to teardown/restart a thread if we are already watching
        # the right directories.
        if self._watching != should_be_watching:
            self._stop_background_thread()

        # Only create a new background thread if we still have handlers
        # and one isn't already running
        if len(self._handlers) > 0 and self._background_thread is None:
            self._start_background_thread()

        return self

    def _start_background_thread(self):
        if self._background_thread is not None:
            return self

        self._stop_event = threading.Event()
        self._watching = set(p.parent for p in self._handlers.keys())

        def run():
            from watchfiles import watch, Change

            for changes in watch(*self._watching, stop_event=self._stop_event):
                for change, path in changes:
                    path = pathlib.Path(path)
                    if path in self._handlers and change != Change.deleted:
                        contents = path.read_text()
                        for handler in self._handlers[path]:
                            handler(contents)

        self._background_thread = threading.Thread(target=run, daemon=True)
        self._background_thread.start()
        return self

    def _stop_background_thread(self):
        if self._background_thread is None:
            return self
        assert self._stop_event is not None

        try:
            # queue exit event and wait for thread to terminate
            self._stop_event.set()
            self._background_thread.join()
        finally:
            self._stop_event = None
            self._background_thread = None
            self._watching.clear()

        return self


watcher = LiveWatcher()
