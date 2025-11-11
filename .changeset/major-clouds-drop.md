---
"anywidget": patch
---

Override **repr** to avoid expensive trait serialization #906

Previously, `AnyWidget` inherited `ipywidgets.Widget.__repr__` which serialized all trait values. This is costly because the repr might not even be shown to users, yet it forces a full serialization of potentially large data. `AnyWidget` now overrides `__repr__` to use `object.__repr__(self)`, which produces a simple `<module.ClassName object at 0x...>` format.

To restore the previous behavior showing all trait values, users can define:

```python
class MyWidget(anywidget.AnyWidget):
    def __repr__(self):
        return traitlets.HasTraits.__repr__(self)
```
