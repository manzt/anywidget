---
"@anywidget/types": minor
"anywidget": minor
---

Allow `initialize` to return an exports object

`initialize` can now return a plain object to expose a programmatic API for the widget. This API is accessible to parent widgets via `host.getWidget()`.

```js
export default {
  initialize({ model }) {
    return {
      getValue: () => model.get("value"),
      setValue: (v) => {
        model.set("value", v);
        model.save_changes();
      },
    };
  },
  render({ model, el }) {
    /* ... */
  },
};
```

The return type is distinguished by `typeof`: functions are treated as cleanup callbacks (existing behavior), objects are treated as exports, and `void` means neither.
