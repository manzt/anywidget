---
"anywidget": patch
---

feat: auto-create (and watch) `FileContents` for valid file paths

```python
import anywidget
import traitlets

class Counter(anywidget.AnyWidget):
    _esm = "index.js"
    value = traitlets.Int(0).tag(sync=True)
```

If a file path for an existing file is detected for `_esm` or `_css`,
the contents will be read from disk automatically. If the path is outside
of `site-packages`, the file will be watched in a background thread and
changes will be emitted widget instance for live reloads.
