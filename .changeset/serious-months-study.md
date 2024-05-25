---
"anywidget": patch
---

Add IPython Cell Magic for HMR

New `%%vfile` cell magic for prototyping widgets in notebooks. Enables syntax highlighting and anywidget's Hot Module Replacement (HMR) directly within the notebook.

Previously, front-end code had to be inline strings or file paths, causing loss of widget state when editing inline-strings in notebooks. The new `%%vfile` cell magic allows editing front-end code within the notebook with live reloading on cell re-execution.

Use `%%vfile <filename>` to create a virtual file for either JavaScript or CSS, and use `vfile:<filename>` in `_esm` or `_css` attributes of an `AnyWidget` subclass to reference the virtual file. Anywidget applies HMR updates automatically on cell re-execution.

`In[1]`:

```python
%load_ext anywidget
```

`In[2]`:

```js
%%vfile index.js
export default {
  render({ model, el }) {
    el.innerHTML = `<h1>Hello, ${model.get("name")}!</h1>`;
  }
}
```

`In[3]`:

```py
import anywidget
import traitlets

class Widget(anywidget.AnyWidget):
    _esm = "vfile:index.js"
    name = traitlets.Unicode("world")

Widget()
```
