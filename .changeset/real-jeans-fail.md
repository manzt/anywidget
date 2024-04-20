---
"anywidget": patch
---

Make a blanket `_repr_mimbundle_` implementation

`ipywidgets` v7 and v8 switched from using `_ipython_display_` to `_repr_mimebundle_` for rendering widgets in Jupyter. This means that depending on which version of `ipywidgets` used (v7 in Google Colab), anywidget end users need to handle the behavior of both methods. This change adds a blanket implementation of `_repr_mimebundle_` so that it is easier to wrap an `anywidget`:

```python
import anywidget
import traitlets

class Widget(anywidget.AnyWidget):
    _esm = "index.js"
    _css = "style.css"
    value = traitlets.Unicode("Hello, World!").tag(sync=True)

class Wrapper:
    def __init__(self):
        self._widget = Widget()

    # Easy to forward the underlying widget's repr to the wrapper class, across all versions of ipywidgets
    def _repr_mimebundle_(self, include=None, exclude=None):
        return self._widget._repr_mimebundle_(include, exclude)
```
