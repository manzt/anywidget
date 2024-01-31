---
title: "A Year with anywidget"
description: "Announcing anywidget v0.9: new lifecycle hooks"
layout: ../../layouts/MainLayout.astro
authors: ["Trevor Manz"]
image:
  {
    src: "widget-lifecycle.png",
    alt: "anywidget logo and anywidget Python code defining a counter widget",
  }
---

> The **anywidget** community is growing! Join us on
> [Discord](https://discord.gg/W5h4vPMbDQ) 🐣

_TL;DR: **anywidget** v0.9 introduces `initialize` and `render` <u>lifecycle
hooks</u> to allow greater control of front-end widget behavior_. _The
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

_Exporting a `render` function directly will still work in v0.9 but trigger a
deprecation notice in the browser console going forward. <a href="#introducing-widget-lifecycle-hooks">Skip ahead.</a>_

## anywidget v0.9

We are excited to announce the release of **anywidget** v0.9. This version
introduces a redesigned API that offers increased control and customization of
widgets in the front end, catering to a broader spectrum of use cases. This
update also shifts to requiring developers to explicitly opt-in to [live
development features](/blog/anywidget-02#native-hot-module-replacement-hmr).

### Mimimizing Friction in Jupyter Front Ends

**anywidget** aims to make creating and sharing Jupyter Widgets as simple as
possible. Our solution internalizes the complexities of traditional Jupyter
Widgets by providing alternative, more streamlined APIs.

Historically, one major issue for widget developers has been the reliance on
APIs exposed by traditional Jupyter Widgets in the front end. Since each
notebook environment is responsible for supplying this _runtime_, variations in
implementations can lead to inconsistenct widget behavior across environments
and perplexing bugs.

In **anywidget**, we minimize the _runtime_ APIs available to widget developers
to reduce this friction, exposing a smaller, focused set for communicating with
the Jupyter kernel and interacting with the DOM. This strategy sometimes
requires widget developers to write more code, but with the benefit of better
code introspection and, crucially, the ability ship to end users consistently.
It's worth noting this design allows **anywidget** to implement adapters for
other platforms beyond those currently supporting Jupyter Widgets.

Although the `render` function has generally met the needs of most applications,
community feedback ([#266](https://github.com/manzt/anywidget/issues/266),
[#388](https://github.com/manzt/anywidget/issues/388)) revealed gaps in our
existing implementation for certain real-world widget patterns, prompting us to
refine our front-end API.

### The Widget Lifecycle

Jupyter Widgets adhere to a Model View Controller (MVC) pattern in the
front-end. Briefly, a widget's lifecyle entails:

- _Model Initialization_: On instantiation in Python, a matching front-end model
  is created and synced with a model in the kernel.
- _View Rendering_: Each notebook cell displaying the widget renders an
  independent view based on the model's current state.

![The main parts of the widget lifecyle, including model initialization and view rendering](/widget-lifecycle.png)

**anywidget** handles _model initialization_ automatically using Python model
definition. However, sometimes it's useful to run some custom front-end code
when the front-end model is first created. For example, a widget might need to
register event handlers or fetch initial data just once, or create some state to
share across views. The existing **anywidget** `render` function defines the
logic for _view rendering_.

Recognizing the absence of an API in **anywidget** for _model initialization_
logic, we surveyed existing custom Jupyter Widgets implementations to find
_where_ such behavior typically is defined. We found that widgets typically
extend
[`DOMWidgetModel.initialize`](https://github.com/jupyter-widgets/ipywidgets/blob/b2531796d414b0970f18050d6819d932417b9953/packages/base/src/widget.ts#L150)
for this purpose, and have adopted this naming in our new API.

### Introducing Widget Lifecycle Hooks

The preferred way to define a widget's front-end code is now with a `default`
object export specifying one or more _widget lifecycle hooks_:

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

Combined, these methods introduce finer control for widget developers.

- `initialize`: is executed **once** in the lifetime of a widget, during _model
  initialization_. It has access to the only the `model` to setup non-view event
  handlers or state to share across views.
- `render`: is executed once per view, or during _view rendering_. It has access
  to both the `model` and a unique `el` DOM element. This method should be
  familiar and is used to setup event handlers or access state specific to that
  view.

> Similar to `render`, `initialize` can optionally return a callback that is
> executed at the end of the widget's lifetime.

The `default` export may also be a _function_ which returns (a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
for) this interface: This can be useful to setup some front-end specific state
for the lifecycle of the widget.

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

### Migration

**anywidget** v0.9 adds a deprecation notice for existing named `render`
exports. To migrate, please replace:

```js
export function render({ model, el }) { ... }
```

with:

```js
function render({ model, el }) { ... }

export default { render }
```

## Looking Back

It's been exciting to see the warm reception and growth of **anywidget** since
its release. Some project highlights from last year:

- We launched a [Discord](https://discord.gg/W5h4vPMbDQ) for the **anywidget**
  community – _Join us!_
- I shared
  [post](https://blog.jupyter.org/anywidget-jupyter-widgets-made-easy-164eb2eae102)
  about **anywidget** the [Jupyter blog](https://blog.jupyter.org/)
- The JavaScript Jupyter Widget cookiecutter is now
  [deprecated](https://github.com/jupyter-widgets/widget-cookiecutter) and
  recommends **anywidget** to beginners!
- VS Code has some
  [special logic](https://github.com/microsoft/vscode-jupyter/pulls?q=is%3Apr+sort%3Aupdated-desc+anywidget)
  to ensure **anywidget** "just works" (Thanks!)

I've also enjoyed following projects that have incorporated **anywidget**. To
many to list, but a few:

- [Vega-Altair](https://github.com/altair-viz/altair): declarative (interactive)
  statistical visualization in Python
- [jupyter-scatter](https://github.com/flekschas/jupyter-scatter): interactive
  2D scatter plots that scale to millions of points and support view linking
- [Mosaic](https://github.com/uwdata/mosaic): extensible framework for linking
  interactive views to databases for scalable data processing
- [pyobsplot](https://github.com/juba/pyobsplot): Python interface for
  [Observable Plot](https://observablehq.com/plot/) that supports Pandas and
  Polars dataframes
- [lonboard](https://github.com/developmentseed/lonboard): fast, interactive
  geospatial vector data visualization

I've also stumbled upon an array of creative demos showcasing "widget ideas" on
social media that I'm keen to compile. If you have suggestions on how best to
collect these, I'd love to hear it! In the year to come, I plan to focus on
improving **anywidget**'s documentation and record video tutorials to help
beginners get started with creating their own widgets.
