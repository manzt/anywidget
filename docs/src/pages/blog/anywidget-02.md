---
title: "Modern Web Meets Jupyter"
description: "Announcing anywidget v0.2: Modern Web Development in Jupyter"
layout: ../../layouts/MainLayout.astro
authors: ["Trevor Manz"]
image:
  {
    src: "https://user-images.githubusercontent.com/24403730/213607015-e3fb38f9-5e75-439b-95c9-99e1fde11955.png",
    alt: "anywidget logo and counter example using API",
  }
---

_TL;DR: **anywidget** v0.2 brings modern web development to Jupyter. You can now
use a **file path** to enable **anywidget**'s integrated Hot Module Replacement (HMR):_

```sh
pip install --upgrade "anywidget[dev]"
```

```python
import pathlib
import anywidget
import traitlets

class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js") # path to an existing file
    value = traitlets.Int(0).tag(sync=True)
```

_... the contents of `_esm` are read automatically from disk, and any changes made
to `index.js` are instantly reflected in the front end without refreshing or re-executing
notebook cells. The release also includes various bug fixes and improved support
for rendering widgets in Google Colab. Check [the video](https://www.youtube.com/watch?v=600PU6E4Srw)
previewing some of these features or read on to learn more._

## anywidget v0.2

**anywidget** v0.2 is a significant update that brings new features to dramatically
improve the widget development experience. Some of these features have been on my
wishlist for Jupyter for a while, and I am thrilled to finally share them!

### Native Hot Module Replacement (HMR)

Hot Module Replacement (HMR) is a powerful tool implemented in modern
frameworks like [Vite](https://vitejs.dev/) that enables developers to see
changes in their application user interface without requiring full page load
or clearing state. HMR works by updating only modules that have been modified,
rather than refreshing the entire application. After experiencing web development
with HMR, working with frameworks that lack this capability can be frustrating.

The Vite plugin for **anywidget** currently enables HMR for widget developers, but
at the cost of adding project complexity. While Vite offers a best-in-class developer
experience, its full feature set is not essential for numerous **anywidget** projects.
This tension motivated us to develop **HMR support directly within anywidget**, exposing
a framework for live-reloading without additional configuration.

We included an initial implementation of HMR on top of the Jupyter Widgets framework
in a prior **anywidget** release, but in v0.2 it is fully integrated in the top-level API.
This feature provides a seamless (opt-in) front-end development experience on par
with modern front-end frameworks.

### Effortless Front-End Integration

**anywidget** previously required the `_esm` and `_css` attributes (i.e., the widget front-end code)
to be Python strings. Therefore, separate files had to be read manually from disk:

```python
class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js").read_text()
```

in v0.2, you can now drop the `read_text()` and pass a file path string or
a `pathlib.Path` object directly:

```python
class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
```

and **anywidget** will automatically read the file contents from disk for you.

Now for the magic 🪄. Passing a file path not only offers a convenience to
loading your front-end code, but also **opts in to anywidget's native HMR
<u>during developement</u>.** **anywidget** will start listening for modifications
to the referenced files and instantly apply changes to the front-end, offering
an integrated development experience within Jupyter like never before.

What sets this implementation apart is the ability to deliver
integrated HMR without the need for a separate front-end development server (e.g., Vite,
Webpack, Parcel). In **anywidget**, we reuse the active IPython session and its Comm framework
as our devlopement server, delivering a familiar front-end developer experience to these tools,
but entirely from within Jupyter and tailored towards creating custom widgets.

You can watch [this video](https://www.youtube.com/watch?v=600PU6E4Srw) to see this
modern development workflow in action **entirely from within JupyterLab**, or try
it our yourself.

### Embracing Type Safety in the Front End

This release also introduces the type-only `anywidget/types` submodule on
NPM, enabling developers who use TypeScript to benefit from enhanced type safety
in their front-end widget code. Widget authors can specify their model's types in
front-end take advantage of autocomplete and IntelliSense features within their editor.
For example, for the following Python module:

```python
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
// @ts-check
/**
 * @typedef Model
 * @prop {number} value - the current count value
 */

/** @type {import("anywidget/types").Render<Model>} */
export function render({ model, el }) {
	let value = model.get("value");
	//^? number

	model.get("nope");
	// type error, `nope` is not defined on Model

	model.set("value", "not a number");
	//^? type error, must be a number
}
```

The `import("anywidget/widget").Render<Model>` utilty strictly types the `render` function such that
`model.get` and `model.set` are typed based on the user-defined `Model`.

This feature brings Jupyter Widgets one step closer to having **end-to-end type safety**, and
the use of TypeScript within JSDoc comments means that widget front-end code can benefit
from static analysis without additional compilation, much like Python's builtin type hints.

### Defining Custom Cleanup Logic

Prior versions of **anywidget** did not expose a dedicated API for defining cleanup logic for a view.
In v0.2, we're introducing an API (inspired by React's `useEffect` hook) to allow developers to define
a callback that is executed any time the a view is removed from the DOM. This enhancement is useful
when dealing with complex event listeners, subscriptions, or third-party libraries that require proper
teardown.

Although this feature might not be essential for all use cases, it provides a flexible and more declarative
way to ensure proper cleanup when needed:

```javascript
export function render({ model, el }) {
	// Create DOM elements and set up subscribers
	return () => {
		// Optionally cleanup
	};
}
```

This new API is particularly useful when working with third-party libraries like React
that take control of the DOM and require proper cleanup to prevent exceptions when
elements are unmounted. For example:

```javascript
import * as React from "https://esm.sh/react@18";
import * as ReactDOM from "https://esm.sh/react-dom@18/client";

function App(props) {
	return <h1>Hello, world</h1>;
}

export function render({ model, el }) {
	let root = ReactDOM.createRoot(el);
	root.render(<App />);
	return () => root.unmount();
}
```

> Note: The above front-end code requires transformation with tool like `esbuild`
> to allow for the special JSX syntax (e.g., `<App />`).

## Getting Started

To start using **anywidget** v0.2, upgrade your package using pip:

```sh
pip install --upgrade "anywidget[dev]"
```

I encourage you to explore the new features in **anywidget** v0.2 and experience the
modern web development practices it brings to the Jupyter ecosystem. Happy coding!
