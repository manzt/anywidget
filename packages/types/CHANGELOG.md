# @anywidget/types

## 0.4.0

### Minor Changes

- Allow `initialize` to return an exports object ([#974](https://github.com/manzt/anywidget/pull/974))

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

- Add `host.getWidget` and `host.getModel` for widget composition ([#974](https://github.com/manzt/anywidget/pull/974))

  `render` now receives a `host` prop with methods to resolve child widgets by reference, enabling one anywidget to render another inside its DOM.

  ```js
  export default {
    async render({ model, el, signal, host }) {
      let child = await host.getWidget(model.get("slider"));
      await child.render({ el, signal });
    },
  };
  ```

  On the Python side, widget references are serialized as `"anywidget:<model_id>"` strings. A new `WidgetTrait` traitlet validates anywidget-compatible objects, and a `Widget` type alias is provided for annotations:

  ```python
  import anywidget

  class Dashboard(anywidget.AnyWidget):
      _esm = "dashboard.js"
      slider = anywidget.WidgetTrait().tag(sync=True)

  Dashboard(slider=Slider())
  ```

  `host.getWidget(ref)` returns `{ exports, render }` where `exports` is the object returned from the child's `initialize`, and `render({ el, signal })` mounts the child's view. `host.getModel(ref)` returns the raw model for lower-level access.

## 0.3.0

### Minor Changes

- Clarify `change:` event callback signature as `() => void` ([#938](https://github.com/manzt/anywidget/pull/938))

  The `on("change:...")` callback now takes no arguments. Use `model.get()` inside the callback to read the current value. The previous signature with `(_: unknown, value: Payload)` leaked Backbone.js implementation details from ipywidgets that are not portable across host platforms.

## 0.2.0

### Minor Changes

- Makes explicit WidgetManager interface ([#670](https://github.com/manzt/anywidget/pull/670))

  Drops `@jupyter-widgets/base` as a dependency and instead makes an explicit
  interface for `AnyModel.widget_manager`. Right now we only support
  `widget_manager.get_model`, so having the other methods on the interface was
  misleading (leading to issues around `.create_view` not being supported).

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
