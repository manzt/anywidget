from __future__ import annotations
from collections import defaultdict

import pathlib
import threading
from typing import TYPE_CHECKING, Callable


if TYPE_CHECKING:
    from ._protocols import AnywidgetProtocol
    from .widget import AnyWidget


class BackgroundWatcher:
    _thread: None | tuple[threading.Thread, threading.Event] = None
    _handlers: defaultdict[pathlib.Path, set[Callable[[str], None]]]
    _dirs: set[pathlib.Path]

    def __init__(self):
        self._handlers = defaultdict(set)
        self._dirs = set()

    def watch(self, file: str | pathlib.Path, handler: Callable[[str], None]):
        file = pathlib.Path(file).absolute()

        self._handlers[file].add(handler)
        new_dirs = set(p.parent for p in self._handlers.keys())

        if new_dirs == self._dirs:
            return self

        self._dirs = new_dirs
        self.start()
        return self

    def start(self):
        from watchfiles import watch, Change

        if self._thread:
            self.stop()

        stop_event = threading.Event()

        def run():
            for changes in watch(*self._dirs, stop_event=stop_event):
                for change, path in changes:
                    path = pathlib.Path(path)
                    if path in self._handlers and change != Change.deleted:
                        contents = path.read_text()
                        for handler in self._handlers[path]:
                            handler(contents)

        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        self._thread = thread, stop_event

        return self

    def stop(self):
        if self._thread is None:
            return
        thread, stop_event = self._thread
        stop_event.set()
        thread.join()
        self._thread = None
        return self


watcher = BackgroundWatcher()
