# anywidget

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
