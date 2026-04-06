---
"@anywidget/types": minor
"anywidget": minor
---

Add `host.getWidget` and `host.getModel` for widget composition

`render` now receives a `host` prop with methods to resolve child widgets by reference, enabling one anywidget to render another inside its DOM.

```js
export default {
  async render({ model, el, signal, host }) {
    let child = await host.getWidget(model.get("slider"));
    await child.render({ el, signal });
  },
};
```

On the Python side, widget references are serialized as `"anywidget:<model_id>"` strings. A new `WidgetTrait` traitlet validates anywidget-compatible objects, and a `Widget` type alias is provided for annotations:

```python
import anywidget

class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    slider = anywidget.WidgetTrait().tag(sync=True)

Dashboard(slider=Slider())
```

`host.getWidget(ref)` returns `{ exports, render }` where `exports` is the object returned from the child's `initialize`, and `render({ el, signal })` mounts the child's view. `host.getModel(ref)` returns the raw model for lower-level access.
