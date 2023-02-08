from __future__ import annotations
from collections import defaultdict

import pathlib
import threading
from typing import Callable, Mapping

FileChangeHandler = Callable[[str], None]
Handlers = Mapping[pathlib.Path, set[FileChangeHandler]]


class LiveWatcher:
    _background_thread: threading.Thread | None = None
    _stop_event: None | threading.Event = None

    def __init__(self):
        self._handlers: Handlers = defaultdict(set)
        self._watching: set[pathlib.Path] = set()

    def watch(self, file: str | pathlib.Path, handler: FileChangeHandler):
        file = pathlib.Path(file).absolute()
        assert file.is_file(), "Can only add individual files to watch"

        self._handlers[file].add(handler)

        # Our background thread watches directories for changes, so we
        # consolidate all file parents (directories) that we need to watch.
        should_be_watching = set(p.parent for p in self._handlers.keys())

        # No need to teardown/restart a thread if we are already watching
        # the right directories.
        if self._watching == should_be_watching:
            return self

        # Update what we should be watching and (re)start the thread.
        self.start()  # tearsdown existing thread if needed
        return self

    def start(self):
        # kill an existing thread
        if self._background_thread:
            self.stop()

        self._stop_event = threading.Event()

        def run():
            from watchfiles import watch, Change

            for changes in watch(*self._watching, stop_event=self._stop_event):
                for change, path in changes:
                    path = pathlib.Path(path)
                    if path in self._handlers and change != Change.deleted:
                        contents = path.read_text()
                        for handler in self._handlers[path]:
                            handler(contents)

        self._watching = set(p.parent for p in self._handlers.keys())
        self._background_thread = threading.Thread(target=run, daemon=True)
        self._background_thread.start()
        return self

    def stop(self):
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
