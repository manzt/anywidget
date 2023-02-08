from __future__ import annotations

import pathlib
import threading
from typing import Callable, TYPE_CHECKING
import weakref

from anywidget._descriptor import ReprMimeBundle

FileChangeHandler = Callable[[str], None]

if TYPE_CHECKING:
    from anywidget.widget import AnyWidget
    from anywidget._protocols import AnywidgetProtocol


class BackgroundFileWatcher:
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

        self._handlers_changed()
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

        self._handlers_changed()
        return self

    def _handlers_changed(self):
        # Our background thread watches directories for changes, so we
        # consolidate all file parents (directories) that we need to watch.
        should_be_watching = set(p.parent for p in self._handlers.keys())

        # No need to teardown/restart a thread if we are already watching
        # the right directories.
        if self._watching != should_be_watching:
            self._stop_background_thread()

        # Only create a new background thread if we still have handlers
        # and one isn't already running
        if len(self._handlers) > 0 and self._background_thread is None:
            self._start_background_thread()

    def _start_background_thread(self):
        if self._background_thread is not None:
            return self

        self._stop_event = threading.Event()

        def run():
            from watchfiles import watch, Change

            self._watching = set(p.parent for p in self._handlers.keys())

            for changes in watch(*self._watching, stop_event=self._stop_event):
                for change, path in changes:
                    path = pathlib.Path(path)
                    if path in self._handlers and change != Change.deleted:
                        contents = path.read_text()
                        for handler in self._handlers[path]:
                            handler(contents)

            self._watching.clear()

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

        return self


file_watcher = BackgroundFileWatcher()


def watch_files(obj: AnyWidget | AnywidgetProtocol):
    repr_obj = obj._repr_mimebundle_

    if isinstance(repr_obj, ReprMimeBundle):
        for key, path in repr_obj._watchable.items():

            def handler(contents: str, key: str = key):
                repr_obj._extra_state[key] = contents
                repr_obj.send_state(key)

            file_watcher.watch(path, handler)
            weakref.finalize(obj, file_watcher.unwatch, path, handler)
    else:
        widget: AnyWidget = obj  # type: ignore

        for key, path in widget._watchable.items():

            def handler(contents: str, key: str = key):
                setattr(widget, key, contents)

            file_watcher.watch(path, handler)
            weakref.finalize(obj, file_watcher.unwatch, path, handler)
