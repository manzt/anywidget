---
title: "anywidgets All the Way Down"
description: "Announcing anywidget v0.11: widget composition"
layout: ../../layouts/MainLayout.astro
authors: ["Trevor Manz"]
---

> The **anywidget** community is growing! Join us on
> [Discord](https://discord.gg/W5h4vPMbDQ)

_TL;DR: **anywidget** v0.11 expands the AFM with three additive primitives: an
`AbortSignal` for lifecycle cleanup, an `exports` object returned from
`initialize`, and a `host` API that lets one widget render and talk to another._

_All existing widgets keep working without changes._

```sh
pip install --upgrade anywidget
```

```js
export default {
  initialize({ model, signal }) {
    return {
      // exports: the widget's programmatic JS-side interface
      getValue: () => model.get("value"),
    };
  },
  async render({ model, el, signal, host }) {
    let child = await host.getWidget(model.get("control"));
    let div = document.createElement("div");
    el.appendChild(div);
    await child.render({ el: div, signal });
  },
};
```

## anywidget v0.11

This release implements the [widget composition
RFC](https://github.com/manzt/anywidget/blob/main/rfcs/0001-widget-composition-and-signals.md)
shared earlier this year. The changes described below are all additive:
existing widgets should keep working without modification.

For the past year, **anywidget** has predominantly been in maintenance mode.
The library works, and the community has been expanding on both ends (more host
platforms and more widgets shipped on top of it.

A stretch of stability also tends to surface what's still missing. One pattern
that kept coming up was a different _kind_ of widget than the AFM had been
designed around
([#28](https://github.com/manzt/anywidget/issues/28),
[#193](https://github.com/manzt/anywidget/issues/193),
[#855](https://github.com/manzt/anywidget/issues/855)).

Prior to v0.11, **anywidget** was a good fit for widgets that own a
self-contained piece of the screen (a chart, a map, a control). Two limitations
got in the way of anything else.

**Composition was left to the host.** A widget that wants to lay out other
widgets had to be expressed using whatever container the host platform
provides:

```python
ipywidgets.HBox([widget_a, widget_b])     # Jupyter / Lab
mo.hstack([widget_a, widget_b])           # marimo
```

This is fine for end users, but it means a widget author who wants to ship
their _own_ layout primitive (a tabbed container, a draggable panel, a kanban
board) had no way to do it within **anywidget** itself. _Container widgets_,
widgets agnostic to their children that perform a layout, were not expressible
in the AFM.

**Shared interfaces were limited to model state.** The only thing one widget
could know about another was what was exposed on the synced model. A widget
that wanted to call `panTo(lat, lng)` or `highlight(rowId)` on another widget
on the page had to round-trip through a synced state. That works for state, but
it forces every JS-side capability behind a Python round-trip.

v0.11 closes both gaps. There are three additions to the front-end contract:

- `signal`: an `AbortSignal` on `initialize` and `render` for lifecycle cleanup.
- `initialize` MAY return an **exports** object: the widget's programmatic JS interface, made available to other widgets on the page.
- `host.getWidget` / `host.getModel` on `render`: resolve a widget reference passed in from Python, render it inside your view, or talk to it via its exports.

Together these changes enable a new pattern: widgets that compose other
widgets, with a clear contract for how parent and child share lifecycle,
rendering, and programmatic surface.

### Lifecycle via AbortSignal

Both `initialize` and `render` now receive an
[`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
on their props. The host aborts it when the widget is destroyed (or during
HMR). This is the preferred way to manage cleanup going forward since it
composes with the broader web platform (`addEventListener`, `fetch`, child
widgets) and collapses setup and teardown into a single block of code:

```js
// before
export default {
  render({ model, el }) {
    let handler = () => { /* ... */ };
    el.addEventListener("click", handler);
    return () => {
      el.removeEventListener("click", handler);
    }
  },
};

// after
export default {
  render({ model, el, signal }) {
    let handler = () => { /* ... */ };
    el.addEventListener("click", handler, { signal });
  },
};
```

Returning a cleanup callback from `render` (or `initialize`) still works so
existing widgets need no changes. New code is encouraged to prefer `signal`.

### `initialize` Returns Exports

`initialize` runs once per widget instance, before any view is rendered. In
v0.11, it MAY return an arbitrary object: the widget's **exports**. The host
stores that object and makes it available to other widgets that resolve this
one as a reference (next section).

```js
export default () => ({
  initialize({ model, signal }) {
    return {
      getValue: () => model.get("value"),
      setValue: (v) => {
        model.set("value", v);
        model.save_changes();
      },
      onChange: (cb) => model.on("change:value", cb),
    };
  },
  render({ model, el, signal }) {
    /* ... */
  },
});
```

Returning a plain object is opt-in. Returning a function is still
treated as a cleanup callback (existing behavior). Returning nothing is
still fine. The host distinguishes the three cases via `typeof`.

The naming mirrors VS Code's `Extension.exports` and ES module semantics:
**exports** is what your widget makes available for others to use. There is no
schema, no decoration, no validation. Widget authors define their own
interfaces and consumers duck-type at the boundary.

### Composition: `host.getWidget` / `host.getModel`

`render` now receives a `host` prop. It exposes two async methods that resolve
a widget reference (more on what those are below):

```ts
interface Host {
  getWidget<T>(ref: string): Promise<{
    exports: T;
    render(opts: { el: HTMLElement; signal?: AbortSignal }): Promise<void>;
  }>;
  getModel<T>(ref: string): Promise<AnyModel<T>>;
}
```

`host.getWidget` waits for the child's `initialize` to complete, then returns
its `exports` and a `render` function bound to that child. `host.getModel` is a
lower-level escape hatch that returns the child's underlying `AnyModel` for
direct event subscriptions and `get`/`set`/`send` access without participating
in rendering.

Passing the parent's `signal` through to the child's `render` ties their
lifecycles together. When the parent's signal aborts (because the parent view
is being torn down or HMR is replacing it), the child's view tears down with
it.

On the Python side, you pass widgets directly. The serialization layer
auto-detects anything that adheres to the **anywidget protocol** (objects with
a `MimeBundleDescriptor` at `_repr_mimebundle_`) or extends
`anywidget.AnyWidget`, and replaces it with a wire-format string of the form
`"anywidget:<model_id>"` at its position in the state. This works at any depth
(top-level traits, values inside dicts, items inside lists).

```python
import anywidget
import traitlets

class Slider(anywidget.AnyWidget):
    _esm = "slider.js"
    value = traitlets.Float(0.0).tag(sync=True)
    min = traitlets.Float(0.0).tag(sync=True)
    max = traitlets.Float(100.0).tag(sync=True)

class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    control = anywidget.WidgetTrait().tag(sync=True)

slider = Slider(value=50)
Dashboard(control=slider)  # just pass the widget (no wrapper, no children list)
```

`anywidget.WidgetTrait` is a new traitlet that validates the assigned object is
anywidget-compatible (or `None`). For dataclass / pydantic / msgspec users,
`anywidget.Widget` is exported as a type alias for annotations.

### Putting It Together

A `Dashboard` that renders a `Slider` as a child widget, reacting to changes
the slider exposes through its exports. The Python side passes the slider
directly:

```python
import anywidget, traitlets

class Slider(anywidget.AnyWidget):
    _esm = "slider.js"
    value = traitlets.Float(0.0).tag(sync=True)
    min = traitlets.Float(0.0).tag(sync=True)
    max = traitlets.Float(100.0).tag(sync=True)

class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    control = anywidget.WidgetTrait().tag(sync=True)

Dashboard(control=Slider(value=50, min=0, max=100))
```

`slider.js` returns its programmatic interface from `initialize` and uses
`signal` for cleanup:

```js
export default () => ({
  initialize({ model }) {
    return {
      getValue: () => model.get("value"),
      onChange: (cb) => model.on("change:value", cb),
    };
  },
  render({ model, el, signal }) {
    let input = Object.assign(document.createElement("input"), {
      type: "range",
      min: model.get("min"),
      max: model.get("max"),
      value: model.get("value"),
    });
    input.addEventListener(
      "input",
      () => {
        model.set("value", parseFloat(input.value));
        model.save_changes();
      },
      { signal },
    );

    let onChange = () => {
      input.value = model.get("value");
    };
    model.on("change:value", onChange);
    signal.addEventListener("abort", () => model.off("change:value", onChange));

    el.appendChild(input);
  },
});
```

`dashboard.js` resolves the slider via `host.getWidget`, reads its exports,
and renders it inside its own DOM:

```js
export default {
  async render({ model, el, signal, host }) {
    let slider = await host.getWidget(model.get("control"));

    if (typeof slider.exports?.onChange === "function") {
      slider.exports.onChange(() => {
        console.log("value:", slider.exports.getValue());
      });
    }

    let div = document.createElement("div");
    el.appendChild(div);
    await slider.render({ el: div, signal });
  },
};
```

The full version, including a TypeScript type guard at the consumer boundary,
is in the
[RFC](https://github.com/manzt/anywidget/blob/main/rfcs/0001-widget-composition-and-signals.md#example).

### A Richer Host Contract

The pattern these primitives establish is that more responsibility now sits
with the host runtime. The host maintains a registry of widget bindings keyed
by model, parses ref strings, waits for `initialize` to complete before
resolving `host.getWidget`, and creates an `AbortController` per view that
cascades through the composition tree.

For host implementations that **don't (yet) support composition**, the AFM's
guidance is simple: **fail loudly and early**. The reference implementation
shipping in this release does this in three places:

- `parseWidgetRef` rejects malformed refs synchronously with the offending
  value in the message.
- `host.getWidget` throws when the child model has no registered binding
  (`[anywidget] No binding found for widget <id>`) instead of returning a
  silently broken handle.
- A 10-second timeout on `child.ready` rejects with
  `[anywidget] Timed out waiting for widget <id> to initialize`, so a child
  whose `initialize` never resolves becomes a clear runtime error rather than
  a hung promise.

These are small details, but they matter for ecosystem health: hosts that
choose not to implement composition can drop in a `host` that throws
descriptively, and widget authors will see the same shape of error everywhere
instead of one notebook environment failing in a different way than another.

### Migration

To start using **anywidget** v0.11:

```sh
pip install --upgrade anywidget
```

There is nothing required to migrate. Existing widgets will continue work
unchanged. New widgets can opt into `signal`, `exports`, and `host`
incrementally, hook by hook.

If you maintain a host runtime (a notebook front end, a custom embed) and want
to opt into the new APIs, the four host requirements are documented at the end
of [the
RFC](https://github.com/manzt/anywidget/blob/main/rfcs/0001-widget-composition-and-signals.md#host-requirements).
The reference implementation in `packages/anywidget` is small enough to read
end-to-end if it helps.

Happy composing.
