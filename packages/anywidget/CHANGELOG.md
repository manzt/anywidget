# anywidget

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
