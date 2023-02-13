---
"anywidget": patch
---

feat: add ESM fallback if none is specified for an `anywidget.AnyWidget` subclass (#45)

```python
class MyWidget(anywidget.AnyWidget):
    ...

MyWidget()
# Dev note: Implement an `_esm` attribute on AnyWidget subclass
# `__main__.MyWidget` to customize this widget.
```
