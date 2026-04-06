---
"@anywidget/types": minor
"anywidget": minor
"@anywidget/vite": minor
---

Add `signal` ([`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)) to `initialize` and `render` props for lifecycle cleanup

Both `initialize` and `render` now receive an `AbortSignal` via the `signal` prop. The signal is aborted when the widget is destroyed (or during HMR). This is the preferred way to manage cleanup going forward — it composes with the broader web platform (`addEventListener`, `fetch`, child widgets) and avoids the need to manually track teardown logic.

The previous callback-based pattern continues to work but is no longer recommended:

```js
// before
export default {
  render({ model, el }) {
    let handler = () => { /* ... */ };
    model.on("change:value", handler);
    return () => model.off("change:value", handler);
  },
};

// after
export default {
  render({ model, el, signal }) {
    let handler = () => { /* ... */ };
    model.on("change:value", handler);
    signal.addEventListener("abort", () => model.off("change:value", handler));
  },
};
```

`signal` also works with `addEventListener` and `fetch` directly:

```js
export default {
  render({ model, el, signal }) {
    el.addEventListener(
      "click",
      () => {
        /* ... */
      },
      { signal },
    );
  },
};
```
