---
"@anywidget/types": minor
---

Clarify `change:` event callback signature as `() => void`

The `on("change:...")` callback now takes no arguments. Use `model.get()` inside the callback to read the current value. The previous signature with `(_: unknown, value: Payload)` leaked Backbone.js implementation details from ipywidgets that are not portable across host platforms.
