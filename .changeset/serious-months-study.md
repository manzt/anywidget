---
"anywidget": patch
---

Add ipython cell magic to enable HMR within Jupyter notebooks

Introduces a new experimental cell magic `%%vfile`, designed for prototyping widget ideas within Jupyter notebooks. This is not intended for production use. The goal is to enable nicer syntax highlighting of code and to allow using anywidget's Hot Module Replacement (HMR) entirely from within a notebook.

Previously, anywidget ESM and CSS had to be provided as inline strings or file paths. Notebook development required editing JS/CSS as inline strings, which resulted in losing widget state to see front-end code changes. Anywidget's HMR enables live reloading of front-end code without losing state, but only by monitoring the file system (requring making separate files for the best DX). With the new `%%vfile` cell magic, you can prototype entirely from within a notebook and enjoy live reloads whenever the cell is re-executed.

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
