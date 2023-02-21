---
"anywidget": patch
---

feat: add (optional) cleanup/unmount return to `render`

```javascript
export function render(view) {
  /* create elements and add event listeners */
  return function cleanup() => {
    /* specify how to cleanup any expensive resources created above */
  }
}
```
