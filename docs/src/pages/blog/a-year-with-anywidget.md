---
title: "A year with anywidget"
description: "Announcing v0.9: a new, more flexible API"
layout: ../../layouts/MainLayout.astro
authors: ["Trevor Manz"]
image:
  {
    src: "https://user-images.githubusercontent.com/24403730/213607015-e3fb38f9-5e75-439b-95c9-99e1fde11955.png",
    alt: "anywidget logo and counter example using API",
  }
---

> The **anywidget** community is growing! Come join us on [Discord](https://discord.gg/W5h4vPMbDQ) 🎸.

_TL;DR: **anywidget** v0.9 introduces a more flexible API for defining
widget front-end code with `initialize` and `render` lifecycle methods. The
preferred way to define widgets is now with a `default` object export:_

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

Exporting a `render` function directly will still work in v0.9 but trigger a
deprecation notice in the browser console going forward.

## anywidget v0.9

It's been an exciting year! We are excited to announce the release of
**anywidget** v0.9, a significant step forward in the project's evolution. This
version introduces a revamped front-end API, allowing more customization over the
widget lifecycle and an expanded range of use cases.

In the following sections, we explore the reasons for these changes and provide
examples to illustrate the capabilities of the new API.

### Mimimizing Friction in Jupyter

**anywidget** aims to make creating and sharing Jupyter Widgets as simple as
possible. Our solution internalizes the complexities of traditional Jupyter
Widgets by providing alternative, more streamlined APIs. Historically, one
major issue for widget developers has been the reliance on APIs exposed by
traditional Jupyter Widgets in the front end. Since each notebook environment
is responsible for supplying this _runtime_, and thus variation in
implementations can lead to inconsistenct widget behavior across environments
and perplexing bugs.

In **anywidget**, we minimize the _runtime_ APIs available to widget developers
to reduce this friction, exposing a smaller, focused set of APIs for
communicating with the Jupyter kernel and interacting with the DOM. This
strategy sometimes requires widget developers to write additional code, but at
the benefit of better code introspection and, crucially, the ability ship to
end users consistently. It's worth noting this design allows **anywidget** 
to implement adapters for other platforms beyond those currently supporting
Jupyter Widgets.

Although the existing API has generally met the needs of most applications,
community feedback ([#266](https://github.com/manzt/anywidget/issues/266),
[#388](https://github.com/manzt/anywidget/issues/388)) revealed gaps in our
existing implementation for certain real-world widget patterns, prompting us to
refine our front-end API.

### Introducing Widget Lifecycle Hooks

Jupyter Widgets are an implementation of MVC

The MVC framework used by Jupyter Widgets, right now anywidget treats Python as
the sole "source of truth" for defining the model and only supports rendering
_views_ of that model in JS (view `render`). We don't currently have an API to
initialize some initial front-end model listeners/state (or allow for a
DOM-less use of anywidget).

Surveying existing Jupyter Widgets in the wild, it seems this type of model
initialization is often defined in the `WidgetModel.initialize` method.  This
PR introduces a new lifecycle method which maybe be implemented for an
anywidget front-end module: `initialize`. Initialize has the same signature as
render, except only `model` is provided in the context.

The semantic difference is that `initialize` is executed _once_ per model
(regardless of whether anything is displayed) and `render` is executed once per
view. 

This update introduces widget "lifecyle" methods for widget devleopers

## Community highlights

- blogged about in Jupyter
- now a recommended way for creating widget (deprecation of widget templates)
- there are now tests in vscode-jupyter specifically to make sure anywidget "just works"
- Project highlights:
	- Mosaic
	- Altair
	- Pyobsplot
	- Jupyter-scatter
	- lonboard
