# @anywidget/vite

## 0.3.0

### Minor Changes

- Add `signal` ([`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)) to `initialize` and `render` props for lifecycle cleanup ([#974](https://github.com/manzt/anywidget/pull/974))

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
        { signal }
      );
    },
  };
  ```

## 0.2.2

### Patch Changes

- Normalize possible AFM inputs to an AFM object when using Vite HMR. ([#881](https://github.com/manzt/anywidget/pull/881))

## 0.2.1

### Patch Changes

- Allow vite v6 as peerDependency ([#760](https://github.com/manzt/anywidget/pull/760))

## 0.2.0

### Minor Changes

- Support anywidget lifecycle APIs (i.e., `default` export) in Vite plugin. Drops support for CJS-based usage of the plugin. The CJS Node API of Vite is deprecated in v5. Follow the [migration guide](https://vitejs.dev/guide/migration#deprecate-cjs-node-api) for more details. ([#598](https://github.com/manzt/anywidget/pull/598))

## 0.1.2

### Patch Changes

- Support Vite v5 ([#389](https://github.com/manzt/anywidget/pull/389))

## 0.1.1

### Patch Changes

- fix: Support refreshing multiple contexts ([#144](https://github.com/manzt/anywidget/pull/144))

## 0.1.0

### Minor Changes

- fix: Support new user render context ([#142](https://github.com/manzt/anywidget/pull/142))
