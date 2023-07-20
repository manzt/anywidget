# @anywidget/types

## 0.1.4

### Patch Changes

- feat: expose the `IWidgetManager` from `@jupyter-widgets/base` to render function. ([`f2dbdbf`](https://github.com/manzt/anywidget/commit/f2dbdbfb099f26132001193a4e9aa3d59849af4f))

## 0.1.3

### Patch Changes

- feat: Infer event payloads from model ([`272782b`](https://github.com/manzt/anywidget/commit/272782bb919355854cf23ccba430c87b7cc28523))

## 0.1.2

### Patch Changes

- feat: Autocomplete event names for known model events ([#151](https://github.com/manzt/anywidget/pull/151))

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

## 0.1.1

### Patch Changes

- fix: re-expose model.send for custom messages ([#146](https://github.com/manzt/anywidget/pull/146))

## 0.1.0

### Minor Changes

- feat: restrict backbone model access in render context ([#140](https://github.com/manzt/anywidget/pull/140))

- feat!: Limit view fields exposed to render function ([#138](https://github.com/manzt/anywidget/pull/138))

  BREAKING: The render function's argument has been refactored from a full `AnyView` to a simple object. This object only exposes the `model` and `el` fields to the user-provided `render` function. This change aims to simplify the API and reduce potential misuse. Please ensure your render function only depends on these fields.
