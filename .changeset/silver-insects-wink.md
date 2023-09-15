---
"anywidget": patch
---

fix: Keep support for binary traitlets

Uses `structuredClone` to ensure binary data is automatically serialized, correctly. Applies [changes](https://github.com/jupyter-widgets/ipywidgets/pull/3689) reverted in `ipywidgets` 8.1.1.
