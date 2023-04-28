# anywidget

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
