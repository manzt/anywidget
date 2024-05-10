# anywidget

## 0.9.10

### Patch Changes

- fix: Bring back `anywidget.json` to support notebook v6 discovery ([#553](https://github.com/manzt/anywidget/pull/553))

## 0.9.9

### Patch Changes

- Make a blanket `_repr_mimbundle_` implementation ([#546](https://github.com/manzt/anywidget/pull/546))

  `ipywidgets` v7 and v8 switched from using `_ipython_display_` to `_repr_mimebundle_` for rendering widgets in Jupyter. This means that depending on which version of `ipywidgets` used (v7 in Google Colab), anywidget end users need to handle the behavior of both methods. This change adds a blanket implementation of `_repr_mimebundle_` so that it is easier to wrap an `anywidget`:

  ```python
  import anywidget
  import traitlets

  class Widget(anywidget.AnyWidget):
      _esm = "index.js"
      _css = "style.css"
      value = traitlets.Unicode("Hello, World!").tag(sync=True)

  class Wrapper:
      def __init__(self):
          self._widget = Widget()

      # Easy to forward the underlying widget's repr to the wrapper class, across all versions of ipywidgets
      def _repr_mimebundle_(self, include=None, exclude=None):
          return self._widget._repr_mimebundle_(include, exclude)
  ```

## 0.9.8

### Patch Changes

- **experimental** Ensure anywidget.experimental.command is called with self ([#545](https://github.com/manzt/anywidget/pull/545))

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

- Updated dependencies [[`a4b0ec07b2b8937111487108e9b82daf3d9be2df`](https://github.com/manzt/anywidget/commit/a4b0ec07b2b8937111487108e9b82daf3d9be2df)]:
  - @anywidget/types@0.1.9

## 0.9.7

### Patch Changes

- Refactor AnyWidget command registration ([#526](https://github.com/manzt/anywidget/pull/526))

## 0.9.6

### Patch Changes

- Updated dependencies [[`0c629955fee6379234fece8246c297c69f51ee79`](https://github.com/manzt/anywidget/commit/0c629955fee6379234fece8246c297c69f51ee79)]:
  - @anywidget/types@0.1.8

## 0.9.5

### Patch Changes

- feat: Suppress errors when inspecting widget for commands ([#522](https://github.com/manzt/anywidget/pull/522))

## 0.9.4

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

- Updated dependencies [[`777fc268ee06fcf13e48a1c00cfdf90c14d786dc`](https://github.com/manzt/anywidget/commit/777fc268ee06fcf13e48a1c00cfdf90c14d786dc)]:
  - @anywidget/types@0.1.7

## 0.9.3

### Patch Changes

- Updated dependencies [[`9aa8dcc8558e00e33fbe4506b68ae30113df3728`](https://github.com/manzt/anywidget/commit/9aa8dcc8558e00e33fbe4506b68ae30113df3728)]:
  - @anywidget/types@0.1.6

## 0.9.2

### Patch Changes

- Add Python 3.12 Support ([#441](https://github.com/manzt/anywidget/pull/441))

- feat(experimental): Add `@dataclass` decorator ([#222](https://github.com/manzt/anywidget/pull/222))

  ```python
  from anywidget.experimental import dataclass

  @dataclass(esm="index.js")
  class Counter:
      value: int = 0

  Counter()
  ```

- Add error boundaries with nicer stack traces ([#445](https://github.com/manzt/anywidget/pull/445))

## 0.9.1

### Patch Changes

- refactor: Use signals for HMR runtime ([#438](https://github.com/manzt/anywidget/pull/438))

## 0.9.0

### Minor Changes

- Require `ANYWIDGET_HMR` to opt-in to HMR during development ([`ab25564045bbde8bc51ad55ebb09429fa5ca9157`](https://github.com/manzt/anywidget/commit/ab25564045bbde8bc51ad55ebb09429fa5ca9157))

- Introduce front-end widget lifecycle methods ([#395](https://github.com/manzt/anywidget/pull/395))

  **Deprecation Notice**: Exporting a `render` from the front-end widget will
  trigger a deprecation notice in the browser console. The preferred way to define
  a widget's front-end code is now with a `default` object export.

  ```js
  export default {
    initialize({ model }) {
      /* ... */
    },
    render({ model, el }) {
      /* ... */
    },
  };
  ```

  These methods introduce lifecycle hooks for widget developers:

  - `initialize`: is executed once in the lifetime of a widget. It has access to
    the only the `model` to setup non-view event handlers or state to share across
    views.
  - `render`: is executed once per _view_, or for each notebook output cell. It
    has access to the `model` _and_ a unique `el` DOM element. This method should
    be familiar and is used to setup event handlers or access state specific to
    that view.

  The default export may also be a _function_ which returns (a Promise for) this
  interface: This can be useful to setup some front-end specific state for the
  lifecycle of the widget.

  ```js
  export default () => {
    // Create a history of all the changes to the "value" trait
    let valueHistory = [];
    return {
      initialize({ model }) {
        // Push the new changes to history
        model.on("change:value", () => valueHistory.push(model.get("value")));
      },
      render({ model, el }) {
        el.innerText = `The history is ${valueHistory}`;
        // Update each view to display the current history
        model.on("change:value", () => {
          el.innerText = `The history is ${valueHistory}`;
        });
      },
    };
  };
  ```

### Patch Changes

- Fix serialization of `layout` trait ([#426](https://github.com/manzt/anywidget/pull/426))

- Updated dependencies [[`6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd`](https://github.com/manzt/anywidget/commit/6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd)]:
  - @anywidget/types@0.1.5

## 0.8.1

### Patch Changes

- fix: Skip `Promise` serialization for ipywidget's `layout`/`style` traits ([#412](https://github.com/manzt/anywidget/pull/412))

## 0.8.0

### Minor Changes

- Remove re-export of `@anywidget/vite` from main package ([#398](https://github.com/manzt/anywidget/pull/398))

  Breaking change. If using our Vite plugin, please make sure to install
  `@anywidget/vite` (rather than importing from `anywidget` main package). This
  change allows us to version the Vite plugin and anywidget's core separately.

  ```diff
  // vite.config.mjs
  import { defineConfig } from "vite";
  -- import anywidget from "anywidget/vite";
  ++ import anywidget from "@anywidget/vite";
  ```

  If you are already using `@anywidget/vite`, there are no changes necessary.

### Patch Changes

- Updated dependencies [[`ea6d34d042e29c01ec8ce125a756dabf5c6823c0`](https://github.com/manzt/anywidget/commit/ea6d34d042e29c01ec8ce125a756dabf5c6823c0)]:
  - @anywidget/vite@0.1.2

## 0.7.1

### Patch Changes

- feat: Raise Python error when file is missing ([#345](https://github.com/manzt/anywidget/pull/345))

## 0.7.0

### Minor Changes

- feat(experimental)!: Require `include` in `_get_anywidget_state` signature ([#317](https://github.com/manzt/anywidget/pull/317))

  Allows implementors to avoid re-serializing fields which aren't needed to send
  to the front end. This is a **BREAKING** change because it requires implementors
  of `_get_anywidget_state` to account for `include` in the function signature.

  ```python
  from dataclasses import dataclass, asdict
  from io import BytesIO

  import polars as pl
  import psygnal

  @psygnal.evented
  @dataclass
  class Foo:
    value: int
    df: pl.DataFrame

    def _get_anywidget_state(self, include: set[str] | None):
      data = asdict(self)
      if include and "df" in include:
        with BytesIO() as f:
          self.df.write_ipc(f)
          data["df"] = f.getvalue()
      else:
        del data["df"] # don't serialize df to bytes
      return data
  ```

## 0.6.5

### Patch Changes

- fix: disable auto-reloading in `dist-packages` ([#276](https://github.com/manzt/anywidget/pull/276))

  When the package is located in `dist-packages`, auto-reloading is now disabled. This prevents unnecessary warnings when the package is used in environments like Google Colab which are likely non-development installs.

## 0.6.4

### Patch Changes

- fix: Keep support for binary traitlets ([#274](https://github.com/manzt/anywidget/pull/274))

  Uses `structuredClone` to ensure binary data is automatically serialized, correctly. Applies [changes](https://github.com/jupyter-widgets/ipywidgets/pull/3689) reverted in `ipywidgets` 8.1.1.

## 0.6.3

### Patch Changes

- feat: expose the `IWidgetManager` from `@jupyter-widgets/base` to render function. ([`f2dbdbf`](https://github.com/manzt/anywidget/commit/f2dbdbfb099f26132001193a4e9aa3d59849af4f))

- Updated dependencies [[`f2dbdbf`](https://github.com/manzt/anywidget/commit/f2dbdbfb099f26132001193a4e9aa3d59849af4f)]:
  - @anywidget/types@0.1.4

## 0.6.2

### Patch Changes

- feat(descriptor): Auto-detect and serialize `pydantic` v1 and v2 models ([`518ced9`](https://github.com/manzt/anywidget/commit/518ced9ffae209c06d85d2f0de2ed37d51d67edb))

## 0.6.1

### Patch Changes

- feat: Bring back support for Python 3.7 ([#167](https://github.com/manzt/anywidget/pull/167))

## 0.6.0

### Minor Changes

- feat!: Drop support for Python 3.7 ([#161](https://github.com/manzt/anywidget/pull/161))

### Patch Changes

- Updated dependencies [[`272782b`](https://github.com/manzt/anywidget/commit/272782bb919355854cf23ccba430c87b7cc28523)]:
  - @anywidget/types@0.1.3

## 0.5.3

### Patch Changes

- Updated dependencies [[`581e40c`](https://github.com/manzt/anywidget/commit/581e40cd10e2440c574ff0e3b51bc5fd7b85b391)]:
  - @anywidget/types@0.1.2

## 0.5.2

### Patch Changes

- fix: re-expose model.send for custom messages ([#146](https://github.com/manzt/anywidget/pull/146))

- Updated dependencies [[`5a5787b`](https://github.com/manzt/anywidget/commit/5a5787b517075dd8f2c6607dcbc0deac481a9df3), [`774f139`](https://github.com/manzt/anywidget/commit/774f139f45b747caafaa0fac0fd7588d97078db2)]:
  - @anywidget/vite@0.1.1
  - @anywidget/types@0.1.1

## 0.5.1

### Patch Changes

- Updated dependencies [[`79098be`](https://github.com/manzt/anywidget/commit/79098be4bc5a1ce1023318b179b8e73ab3e59be3)]:
  - @anywidget/vite@0.1.0

## 0.5.0

### Minor Changes

- feat: restrict backbone model access in render context ([#140](https://github.com/manzt/anywidget/pull/140))

- feat!: Limit view fields exposed to render function ([#138](https://github.com/manzt/anywidget/pull/138))

  BREAKING: The render function's argument has been refactored from a full `AnyView` to a simple object. This object only exposes the `model` and `el` fields to the user-provided `render` function. This change aims to simplify the API and reduce potential misuse. Please ensure your render function only depends on these fields.

### Patch Changes

- Updated dependencies [[`fc2a626`](https://github.com/manzt/anywidget/commit/fc2a626804dd867cb11d1a9bdecbc713f19cc3be), [`521c0ed`](https://github.com/manzt/anywidget/commit/521c0ede62fbba45eba6bb873fda1c5a16461f2e)]:
  - @anywidget/types@0.1.0

## 0.4.3

### Patch Changes

- fix: Specify UTF-8 encoding in `FileContents.__str__` ([#135](https://github.com/manzt/anywidget/pull/135))

  Fixes an `UnicodeDecodeError` observed on Windows when special characters are present in `_esm` or `_css` elements of a widget.

## 0.4.2

### Patch Changes

- fix(descriptor): forward base obj repr for text/plain mimetype ([#131](https://github.com/manzt/anywidget/pull/131))

## 0.4.1

### Patch Changes

- feat: Add `anywidget.experimental` with simple decorator ([#126](https://github.com/manzt/anywidget/pull/126))

  ```python
  import dataclasses
  import psygnal

  from anywidget.experimental import widget

  @widget(esm="index.js")
  @psygnal.evented
  @dataclasses.dataclass
  class Counter:
      value: int = 0
  ```

## 0.4.0

### Minor Changes

- feat: Add support for evented msgspec.Struct objects ([#64](https://github.com/manzt/anywidget/pull/64))

  Our experimental descriptor API can now work with [`msgspec`](https://jcristharif.com/msgspec/), a fast and efficient serialization library, similar to `pydantic` but with a stronger emphasis on ser/de, and less on runtime casting of Python types.

  ```python
  from anywidget._descriptor import MimeBundleDescriptor
  import psygnal
  import msgspec

  @psygnal.evented
  class Counter(msgspec.Struct, weakref=True):
      value: int = 0
      _repr_mimebundle_: ClassVar = MimeBundleDescriptor(_esm="index.js", autodetect_observer=False)
  ```

## 0.3.1

### Patch Changes

- fix: properly cache cleanup function for HMR ([#122](https://github.com/manzt/anywidget/pull/122))

## 0.3.0

### Minor Changes

- fix: replace deprecated `ipykernel.comm.Comm` with `comm` module ([#119](https://github.com/manzt/anywidget/pull/119))

### Patch Changes

- fix: revert `watchfiles` to optional-dependency ([#118](https://github.com/manzt/anywidget/pull/118))

## 0.2.4

### Patch Changes

- fix: add `watchfiles` as a direct dependency ([#116](https://github.com/manzt/anywidget/pull/116))

## 0.2.3

### Patch Changes

- fix: JS variable scope issue ([`eacc99c`](https://github.com/manzt/anywidget/commit/eacc99ccee32d112d9ca9d31e959f1af15fe4471))

## 0.2.2

### Patch Changes

- feat: log an re-raise error on ESM import failure ([#105](https://github.com/manzt/anywidget/pull/105))

## 0.2.1

### Patch Changes

- fix: allow more flexible semver resolution for `@jupyter-widgets/base` ([`fe00cdf`](https://github.com/manzt/anywidget/commit/fe00cdfa56e983bdc7b2c6c00b30efae75814057))

## 0.2.0

### Minor Changes

- feat: auto-create (and watch) `FileContents` for valid file paths ([#79](https://github.com/manzt/anywidget/pull/79))

  ```python
  import anywidget
  import traitlets

  class Counter(anywidget.AnyWidget):
      _esm = "index.js"
      value = traitlets.Int(0).tag(sync=True)
  ```

  If a file path for an existing file is detected for `_esm` or `_css`,
  the contents will be read from disk automatically. If the resolved
  path is _not_ in `site-packages` (i.e., likely a development install), a
  background thread will start watching for file changes and push updates
  to the front end.

- feat: add `anywidget/types` to npm package to allow opt-in strictness ([#80](https://github.com/manzt/anywidget/pull/80))

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

## 0.1.2

### Patch Changes

- feat: add (optional) cleanup/unmount return to `render` ([#67](https://github.com/manzt/anywidget/pull/67))

  ```javascript
  export function render(view) {
    /* create elements and add event listeners */
    return function cleanup() => {
      /* specify how to cleanup any expensive resources created above */
    }
  }
  ```

- feat: add colab metadata to `_repr_mimebundle_` to fix displaying ipywidgets v7 & v8 in Colab ([#75](https://github.com/manzt/anywidget/pull/75))

## 0.1.1

### Patch Changes

- fix: support ipywidgets v7 and v8 in Google Colab (#52) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

- fix: hot CSS replacement (#65) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

- feat: add ESM fallback if none is specified for an `anywidget.AnyWidget` subclass (#45) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

  ```python
  class MyWidget(anywidget.AnyWidget):
      ...

  MyWidget()
  # Dev note: Implement an `_esm` attribute on AnyWidget subclass
  # `__main__.MyWidget` to customize this widget.
  ```

- feat: add `FileContents` to read/watch files (#62) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

  ```python
  contents = FileContents("./index.js", start_thread=True)

  contents.changed.connect
  def _on_change(new_contents: str):
      print("index.js changed:")
      print(new_contents)
  ```

- chore: deprecate `_module` attribute for `_esm` for defining widget ESM (#66) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

- fix: support Python 3.7 with `from __future__ import annotations` (#44) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

- feat: add `MimeBundleDescriptor` pattern, for more library agnostic Python <> JS communication (#49) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))

  ```python
  from anywidget._descriptor import MimeBundleDescriptor

  import traitlets

  class Counter(traitlets.HasTraits):
      _repr_mimebundle_ = MimeBundleDescriptor(_esm=ESM)
      value = traitlets.Int(0).tag(sync=True)
  ```

- feat: add support for HMR during development (#60) ([`7540ec9`](https://github.com/manzt/anywidget/commit/7540ec9df34c16acafcd01cc2af8b8de263a31d2))
