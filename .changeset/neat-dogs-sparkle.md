---
"anywidget": minor
---

feat: add `anywidget/types` to npm package to allow opt-in strictness

```javascript
// @ts-check

/** @type {import("anywidget/types").Render<{ value: number }>} */
export function render(view) {
  let value = view.model.get("value");
      //^ ? `number`

  view.model.set("value", "not-a-number");
  // Error: Argument of type 'string' is not assignable to parameter of type 'number'. [2345]
}
```
