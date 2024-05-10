# @anywidget/types

## 0.1.9

### Patch Changes

- **experimental** Replace invoke timeout with more flexible `AbortSignal` ([#540](https://github.com/manzt/anywidget/pull/540))

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

## 0.1.8

### Patch Changes

- Export `Experimental` type ([#524](https://github.com/manzt/anywidget/pull/524))

## 0.1.7

### Patch Changes

- Add experimental `invoke` API to call Python functions from the front end and ([#453](https://github.com/manzt/anywidget/pull/453))
  await the response.

  This removes a lot of boilerplate required for this pattern. The API is
  experimental and opt-in only. Subclasses must use the `command` to register
  functions.

  ```py
  class Widget(anywidget.AnyWidget):
      _esm = """
      export default {
        async render({ model, el, experimental }) {
          let [msg, buffers] = await experimental.invoke("_echo", "hello, world");
          console.log(msg); // "HELLO, WORLD"
        },
      };
      """

      @anywidget.experimental.command
      def _echo(self, msg, buffers):
          # upper case the message
          return msg.upper(), buffers
  ```

## 0.1.6

### Patch Changes

- Add `AnyWidget` definition ([`9aa8dcc8558e00e33fbe4506b68ae30113df3728`](https://github.com/manzt/anywidget/commit/9aa8dcc8558e00e33fbe4506b68ae30113df3728))

## 0.1.5

### Patch Changes

- Add `Initialize` method types ([#395](https://github.com/manzt/anywidget/pull/395))

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
