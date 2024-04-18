---
"anywidget": patch
"@anywidget/types": patch
---

Experimental: Replace invoke timeout with more flexible `AbortSignal`

This allows more flexible control over aborting the invoke request, including delegating to third-party libraries that manage cancellation.

```js
export default {
  async render({ model, el }) {
    const controller = new AbortController();

    // Randomly abort the request after 1 second
    setTimeout(() => Math.random() < 0.5 && controller.abort(), 1000);

    const signal = controller.signal;
    model
      .invoke("echo", "Hello, world", { signal })
      .then((result) => {
        el.innerHTML = result;
      })
      .catch((err) => {
        el.innerHTML = `Error: ${err.message}`;
      });
  },
};
```
