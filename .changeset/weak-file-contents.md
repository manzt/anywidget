---
"anywidget": patch
---

Fix a leak where closing a widget with a file-backed `_esm` or `_css` did not release it (#929). The file watcher's change callback held a strong reference to every instance for the life of the process. Open widgets are still held by ipywidgets' registry until `close()`, as before.
