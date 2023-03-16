---
title: "anywidget v0.2"
layout: ../../layouts/MainLayout.astro
authors: ["Trevor Manz"]
image: {
  src: "https://user-images.githubusercontent.com/24403730/213607015-e3fb38f9-5e75-439b-95c9-99e1fde11955.png",
  alt: "anywidget logo and counter example using API",
}
---

_TL;DR: **anywidget** v0.2 brings modern web development to Jupyter. You can now
provide a **file path** for either `_esm` or `_css` attributes to enable
**anywidget**'s integrated Hot Module Replacement (HMR)._

```python
import pathlib
import anywidget
import traitlets

class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
    value = traitlets.Int(0).tag(sync=True)
```

_File contents are read automatically from disk, and any changes made to the
JavaScript or CSS source during development are instantly reflected in the front
end without refreshing or re-executing notebook cells. The release also includes
various bug fixes and improved support for rendering widgets in Google Colab.
Check [the video](https://www.youtube.com/watch?v=600PU6E4Srw) previewing some
of these features or read on to learn more._

## Bringing Modern Web Development to Jupyter

I'm very excited to announce **anywidget** v0.2, a significant update that bring
new features to dramatically improve the widget development experience. Some of
these features have been on my wishlist for Jupyter Widget for a while, and I am
thrilled to share them in this release!

### Native Hot Module Replacement (HMR):

Hot Module Replacement (HMR) is a powerful feature implemented in modern
frameworks like [Vite](https://vitejs.dev/) that enables developers to see
changes in their application's user interface without requiring full page load
or clearing application state. This is achieved by updating only the specific
modules in the application that have been modified, rather than refreshing the
entire application. After experiencing web development with HMR, it becomes
increasingly frustrating to use frameworks that lack this feature.

Although the initial release of **anywidget** incorporated a custom plugin to
facilitate HMR development with Vite, it still posed a barrier for Python
developers seeking an exceptional user experience. While Vite offers a
best-in-class developer experience, its full feature set may not be crucial for
numerous **anywidget** projects. Furthermore, enabling live-reloading with Vite
required additional setup and configuration with frontend tooling, which could
be cumbersome for developers.

We released an implementation of HMR on top of of the Jupyter Widgets framework
directly within **anywidget** in a prior release, but in v0.2 it is fully
integrated in the top-level API. This feature provides a seamless (opt-in)
front-end development experience on par with modern front-end frameworks.

### Automatic detection and loading of front-end code

**anywidget** previously required `_esm` and `_css` file contents to be read
manually from disk as Python strings:

```python
class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js").read_text()
```

in v0.2, you can now drop the `read_text()` and pass a string for a file path or
a `pathlib.Path` object directly.

```python
class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
```

During development, **anywidget** will now start listening for changes to the
referenced source files and apply HMR any time the contents change. This feature
enables **modern web-development entirely from within Jupyter Lab**. You can
check out a live example in
[this video](https://www.youtube.com/watch?v=600PU6E4Srw), or try it out
yourself!

### Embracing Type Safety in the Front End

This release also introduces the type-only `anywidget/types` submodule on
NPM, enabling developers who use TypeScript to benefit from enhanced type safety
in their front-end widget code. Widget authors can specify the expected types in
the front-end code for the model that is defined in Python and take advantage of
autocomplete and IntelliSense features within their editor. For example, for the
following Python module:

```python
# counter.py
import pathlib

import anywidget
import traitlets

class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
    value = traitlets.Int(0).tag(sync=True)
```

the associated widget code may also define the expected types on the Model (i.e., `value`)
[though JSDoc comments](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html):

```javascript
// index.js

/**
 * @typedef Model
 * @prop {number} value - the current count value
 */

/** @type {import("anywidget/types").Render<Model>} */
export function render(view) {
  let value = view.model.get("value");
  //^? number

  view.model.get("nope");
  // type error, `nope` is not defined on Model

  view.model.set("value", "not a number");
  //^? type error, must be a number
}
```

While this feature likely mostly appeals to TypeScript users, it brings Jupyter Widgets
one step closer to having **end-to-end type safety**. The use of TypeScript within JSDoc comments
also means that widget front-end code can benefit from type-safety without needing a 
TypeScript transpiler, much like Python's builtin type hints. By embracing this improvement, developers
can enjoy greater confidence in their code while minimizing the risk of type-related errors.


## Get Started with v0.2:

To start using **anywidget** v0.2, upgrade your package using pip:

```python
pip install --upgrade anywidget
```

I encourage you to explore the new features in **anywidget** v0.2 and experience the
modern web development practices it brings to the Jupyter ecosystem. I hope to
continue to improve **anywidget** to provide the best possible experience for creating
custom Jupyter widgets.

Happy coding!
