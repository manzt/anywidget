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

_Exporting a `render` function directly will trigger a deprecation notice in the
browser console going forward._

## anywidget v0.9

One year later, we are excited to announce the release of **anywidget** v0.9!
This version introduces a redesigned API that offers increased control and
customization of widgets in the front end, catering to a broader spectrum of use
cases. This update also shifts to requiring developers to explicitly opt-in to
[live development features](/blog/anywidget-02#native-hot-module-replacement-hmr),
reducing some hiccups for widgets in production.

### Mimimizing Friction in Jupyter Front Ends

**anywidget** aims to make creating and sharing Jupyter Widgets as simple as
possible. Our solution internalizes the complexities of traditional Jupyter
Widgets, providing a narrower and more web-standard set of APIs to developers.

Historically, one major issue for widget developers has been the reliance on
APIs exposed by traditional Jupyter Widgets in the front end. Since each
notebook environment is responsible for supplying this runtime, variations in
implementations can lead to inconsistenct widget behavior across environments
(and perplexing bugs).

In **anywidget**, we minimize the number of runtime APIs made available to
widget developers to reduce this friction, opting instead for only a small
subset necessary for communicating with the Jupyter kernel and interacting with
the DOM. This strategy sometimes requires widget developers to write extra code,
but it ensures better introspection and, crucially, consistent delivery to end
users. It is worth noting this design also allows **anywidget** to implement
adapters for other platforms beyond those currently supporting Jupyter Widgets.

However, several community members highlighted
([#266](https://github.com/manzt/anywidget/issues/266),
[#388](https://github.com/manzt/anywidget/issues/388)) specific patterns and use
cases where **anywidget**'s current API is restrictive, prompting us to
reevaulate and revise our design. We began by examining the 'lifetime' of
Jupyter Widgets to guide this process.

### The Widget Lifecycle

The
[widget documentation](https://ipywidgets.readthedocs.io/en/8.1.2/examples/Widget%20Low%20Level.html#models-and-views)
states that widgets adhere to a Model View Controller (MVC) pattern in the front
end. Tracing the lifetime of a widget to understand how each part of the MVC
pattern interconnects, we find that there are two distinct steps in a widget's
lifecycle:

- _Model Initialization_: On instantiation in Python, a matching front-end model
  is created and synced with a model in the kernel.
- _View Rendering_: Each notebook cell displaying the widget renders an
  independent view based on the model's current state.

![The main parts of the widget lifecyle, including model initialization and view rendering](/widget-lifecycle.png)

In **anywidget**, developers define _view rendering_ logic with `render`, but
_model initialization_ has been handled automatically by the framework. While
**automatic _model initialization_ is sufficient for most widgets** in the wild,
it can be useful to _hook_ into this step and run custom logic when the
front-end most is first created. For example, a widget might need to register an
event handlers just _once_ or create some state to share across views.

Recognizing the absence of dedicated API in **anywidget** for _model
initialization_, we surveyed existing custom Jupyter Widgets implementations to
find where such behavior typically is defined. We found developers typically
extend
[`DOMWidgetModel.initialize`](https://github.com/jupyter-widgets/ipywidgets/blob/b2531796d414b0970f18050d6819d932417b9953/packages/base/src/widget.ts#L150)
to extend _model initialization_, and have adopted this naming in our new API.

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

- `initialize`: is executed **once** in the lifetime of a widget, during _model
  initialization_. It has access to the only the `model` to setup non-view event
  handlers or state to share across views.
- `render`: is executed once per view, or during _view rendering_. It has access
  to both the `model` and a unique `el` DOM element. This method should be
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

### Migration

This new API comes with a deprecation notice for existing named `render`
exports. To migrate, please replace:

```js
export function render({ model, el }) {/* ... */}
```

with:

```js
function render({ model, el }) {/* ... */}

export default { render };
```

> Similar to `render`, `initialize` can optionally return a callback that is
> executed at the end of the widget's lifetime.

### Other Changes

**anywidget**'s builtin file-watching and hot module replacement (HMR) is only
meant to be used during "live" development, when local widgets are in imported
and used in an active notebook. However, our heuristics for enabling this
feature lead to many false positives, and caused issues issues in various
non-development settings.

**This experience was a bad for end users**

We now require _developers_ to opt-in to this feature, using an environment
variable. You can set this within a notebook:

```python
%env ANYWIDGET_HMR=1
```

or when launching a Jupyter session:

```sh
ANYWIDGET_HMR=1 jupyter lab
```

## Community Highlights and Updates

To wrap up this post, I wanted to share some project and community highlights
since releasing **anywidget** v0.1. It's been exciting to see the warm reception
and growth of the project in the past year. (I'm guessing I likely owe thanks to
many of you still reading this.)

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

I've also enjoyed following projects that have incorporated **anywidget**. To
many to list in total, but to spotlight as few:

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
