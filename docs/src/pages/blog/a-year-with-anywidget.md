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

_TL;DR: **anywidget** v0.9 introduces `initialize` and `render`
<a class="underline" href="#introducing-widget-lifecycle-hooks">lifecyle
hooks</a> to allow greater control of front-end widget behavior_. _The preferred
way to define widgets is now with a `default` object export:_

```sh
pip install --upgrade "anywidget[dev]"
```

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

## anywidget v0.9

We are excited to announce the release of **anywidget** v0.9! This version
introduces a redesigned front-end API that enables more widget types in Jupyter.
This update also requires developers to opt-in to
[live development features](/blog/anywidget-02#native-hot-module-replacement-hmr),
reducing some minor production issues for widgets.

### Mimimizing Friction in Jupyter Front Ends

**anywidget** aims to make creating and sharing Jupyter Widgets as simple as
possible. We expose a narrower set of web-standard APIs, compared to traditional
Jupyter Widgets, to ensure widgets are more consistent (and easier to debug)
across notebook environments.

As a newer library, we've had the opportunity to learn from existing use cases
and understand dependencies of widgets within wider Jupyter ecosystem. We found
that compatibility issues often stem from inconsistencies in notebook front
ends, resulting in mismatches with the APIs developers expect. **anywidget**
focuses on a minimal set of APIs we identified as _essential_ for notebook
integration, boiling down to:

- Communicating with objects in the Jupyter Kernel
- Modifying notebook output cells (i.e., the DOM)

This strategy sometimes requires widget developers to write extra code, but it
ensures better introspection and compatibility. While adopting such APIs at this
stage would be very challenging for traditional Jupyter Widgets, **anywidget**
can standardize certain aspects to make widget development less error-prone and
more accessible.

Despite these goals, serveral several community members highlighted specific
instances where **anywidget**'s existing API was too restrictive
([#266](https://github.com/manzt/anywidget/issues/266),
[#388](https://github.com/manzt/anywidget/issues/388)), prompting us to
reevaulate our design choices. We began by examining the _lifetime_ of Jupyter
Widgets to guide this revision.

### The Widget Lifecycle

Jupyter Widgets
[adhere to a Model View Controller (MVC)](https://ipywidgets.readthedocs.io/en/8.1.2/examples/Widget%20Low%20Level.html#models-and-views)
pattern in the front end. Within Jupyter's MVC implementation, we find that
there are two distinct steps in a widget's lifetime:

- _Model Initialization_: On instantiation in Python, a matching front-end model
  is created and synced with a model in the kernel.
- _View Rendering_: Each notebook cell displaying the widget renders an
  independent view based on the model's current state.

![The main parts of the widget lifecyle, including model initialization and view rendering](/widget-lifecycle.png)

In **anywidget**, _view rendering_ logic is defined with `render`, but
historically _model initialization_ was handled implicitly. While this
auto-initialization is sufficient for most widgets, in advanced cases it can be
useful to define custom _model initialization_ logic. For example, a widget
might need to register a single event handler or create some front-end only
state to share across views.

In the absence of a dedicated API in **anywidget** for _model initialization_,
we surveyed traditional Jupyter Widgets to find where such behavior typically is
defined. We found developers typically extend
[`DOMWidgetModel.initialize`](https://github.com/jupyter-widgets/ipywidgets/blob/b2531796d414b0970f18050d6819d932417b9953/packages/base/src/widget.ts#L150)
to define custom _model initialization_ logic, and have adopted these semantics
in our new API.

### Introducing Widget Lifecycle Hooks

In **anywidget** v0.9, the preferred way to define a widget's front-end code is
now with a `default` object export specifying one or more <u> _widget lifecycle
hooks_</u>:

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

Combined, these hooks introduce finer control for widget developers.

- `initialize`: is executed **once per widget instance**, during _model
  initialization_. It has access to `model` to setup non-view event handlers or
  state to share across views.
- `render`: is executed **once per view**, or during _view rendering_. It has
  access to both the `model` and a `el` DOM element. This method should be
  familiar and is used to setup event handlers or access state specific to that
  view.

The `default` export may also be a _function_ that returns this interface. This
can be useful to setup some front-end specific state for the lifecycle of the
widget.

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

> **Note**: Similar to `render`, `initialize` can optionally return a callback
> that is executed at the end of the widget's lifetime.

### Migration

To start using **anywidget** v0.9, first upgrade your package using pip:

```sh
pip install --upgrade "anywidget[dev]"
```

The new API comes with a deprecation notice for existing named `render` exports.
To migrate, please replace:

```js
export function render({ model, el }) {/* ... */}
```

with:

```js
function render({ model, el }) {/* ... */}

export default { render };
```

### Other Changes

In v0.9, developers need to _opt-in_ to **anywidget**'s live development
features, using an environment variable. You can set this within a notebook:

```python
%env ANYWIDGET_HMR=1
```

or when launching a Jupyter session:

```sh
ANYWIDGET_HMR=1 jupyter lab
```

**anywidget**'s builtin file-watching and hot module replacement (HMR) are only
intended to be used by developers, but the heuristics for enabling these
features lead to many false positives. This caused issues in various production
settings (read: **a bad experience for end-users**), hence our decision to make
them explicitly enabled going forward.

## Community Highlights and Updates

To wrap up this post, I wanted to share some project and community highlights
since **anywidget** v0.1. It's been exciting to see the warm reception and
growth of the project in the past year. (I likely owe thanks to many of you
still reading this.)

Some highlights:

- We launched a [Discord](https://discord.gg/W5h4vPMbDQ) for the **anywidget**
  community – _Join us!_
- I contributed a
  [post](https://blog.jupyter.org/anywidget-jupyter-widgets-made-easy-164eb2eae102)
  about **anywidget** for the [Jupyter blog](https://blog.jupyter.org/)
- The JavaScript Jupyter Widget cookiecutter is now
  [deprecated](https://github.com/jupyter-widgets/widget-cookiecutter) and
  recommends **anywidget** to beginners!
- VS Code has some
  [special logic](https://github.com/microsoft/vscode-jupyter/pulls?q=is%3Apr+sort%3Aupdated-desc+anywidget)
  to ensure **anywidget** _just works_ 🫠

I've also enjoyed following projects that have incorporated **anywidget**. Too
many to list in total, but to spotlight a few:

- [Vega-Altair](https://github.com/altair-viz/altair): declarative (interactive)
  statistical visualization in Python
- [jupyter-scatter](https://github.com/flekschas/jupyter-scatter): interactive
  2D scatter plots that scale to millions of points and support view linking
- [Mosaic](https://github.com/uwdata/mosaic): extensible framework for linking
  interactive views to databases for scalable data processing
- [pyobsplot](https://github.com/juba/pyobsplot): a Python interface for
  [Observable Plot](https://observablehq.com/plot/) that supports Pandas and
  Polars dataframes
- [lonboard](https://github.com/developmentseed/lonboard): fast, interactive
  geospatial vector data visualization

In the year to come, I plan to focus on improving **anywidget**'s documentation
and record video tutorials to help beginners get started with creating their own
widgets. Happy coding!
