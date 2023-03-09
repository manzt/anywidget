---
"anywidget": minor
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
the contents will be read from disk automatically. If the resolved
path is _not_ in `site-packages` (i.e., likely a development install), a
background thread will start watching for file changes and push updates
to the front end.
