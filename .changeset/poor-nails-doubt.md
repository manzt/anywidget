---
"@anywidget/types": patch
---

feat: Autocomplete event names for known model events

```javascript
/**
 * @typedef Model
 * @prop {number} value - the current count
 */

/** @type {import("@anywidget/types").Render<Model>} */
export function render({ model, el }) {
  model.on("change:value", () => { /* ... */);
           // ^ auto-completed in editor
}
```
