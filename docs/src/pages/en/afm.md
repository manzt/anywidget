---
title: "Anywidget Front-End Module (AFM)"
description: "A specification for portable widgets based on ECMAScript modules."
layout: ../../layouts/MainLayout.astro
---

## What is AFM?

The **Anywidget Front-End Module (AFM)** specification defines a standard for
creating portable widget front-end code. Our vision is to enable widget reuse
within and **beyond Jupyter**, including other computational notebooks and
standalone web applications. AFM is oriented around a minimal set of APIs we
identified as essential for integration with [_host platforms_](#host-platform),
boiling down to:

- Bidirectional communication with a host (e.g., Jupyter)
- Modifying output areas (DOM manipulation) (e.g., a notebook output cell)

### Conformance

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** in this document
are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) when, and only when, they
appear in all capitals.

This document describes **AFM as of anywidget 0.11**. Prior revisions did not
include the [`signal`](#cleanup), [`exports`](#exports), or [`host`](#widget-composition)
primitives. Those additions are backward compatible: an AFM authored against
an earlier revision continues to be a valid AFM under this revision.

## Core Concepts

### Front-End Module

The Anywidget Front-end Module is widget front-end code authored by a widget
developer. It contains the front-end logic of a widget, defined by implementing
[lifecycle hooks](#lifecycle) that control the widget's behavior. AFM is a
web-standard ECMAScript module (ESM) that can be authored as a plain text file
or generated from a more complex front-end toolchain.

### Host platform

The web-based environment in which a widget is embedded. It is responsible for
loading AFM modules and calling their [lifecycle hooks](#lifecycle) with the
required platform APIs.

The `anywidget` Python library provides the glue code to make any Jupyter-like
environment (Jupyter Notebook, JupyterLab, Google Colab, VS Code) an
AFM-compatible host platform. The
[marimo](https://github.com/marimo-team/marimo) project is an example of a
_native_ host platform.

A consolidated normative checklist for host implementors is at
[Host requirements](#host-requirements).

## Module shape

An Anywidget Front-End Module is an
[ECMAScript module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
that defines a widget's behavior through [lifecycle hooks](#lifecycle).

```js
export default {
  initialize({ model, signal }) {
    // Set up shared state, event handlers, or programmatic exports.
    // Use `signal` (AbortSignal) for cleanup when the widget is destroyed.
  },
  render({ model, el, signal, host }) {
    // Render the widget's view into the `el` HTMLElement.
    // Use `signal` for view cleanup; use `host` to resolve child widgets.
  },
};
```

Both hooks MAY be `async`. Hosts MUST `await` each hook before treating the
corresponding lifecycle phase as complete (see [Ordering](#ordering)).

The default export MAY also be a function (the **factory form**) that returns
this interface. The factory runs once per widget instance before `initialize`.
State captured in its closure is shared between `initialize` and all
subsequent `render` calls:

```js
export default async () => {
  let extraState = {};
  return {
    initialize({ model, signal }) {
      /* ... */
    },
    render({ model, el, signal, host }) {
      /* ... */
    },
  };
};
```

## Lifecycle

The AFM lifecycle follows a Model-View pattern with two phases:

- **Model initialization**: occurs once when a widget is first created, setting
  up the model and any shared state. Runs `initialize`.
- **View rendering**: occurs each time a widget is displayed (potentially
  multiple times for a single widget instance). Runs `render`.

### Ordering

For a given widget instance, `initialize` MUST complete before any view is
rendered. Hosts MUST `await` the result of `initialize` (including any
returned promise) before calling `render` for that widget. Multiple views MAY
be rendered concurrently and share the same model and `initialize`-time state.

### `initialize`

```ts
initialize(props: {
  model: AnyModel;
  signal: AbortSignal;
}): Awaitable<void | (() => Awaitable<void>) | object>;
```

Executed once per widget instance. Receives:

- `model`: the [model interface](#model-interface).
- `signal`: an `AbortSignal` the host MUST abort when the widget is destroyed.

`initialize` MAY return one of three shapes. The host distinguishes them via
`typeof`:

| Return value | Interpretation                                            |
| ------------ | --------------------------------------------------------- |
| `void`       | No cleanup, no exports.                                   |
| `() => void` | Cleanup callback. Hosts MUST run it when `signal` aborts. |
| `object`     | Widget [exports](#exports). Use `signal` for cleanup.     |

### `render`

```ts
render(props: {
  model: AnyModel;
  el: HTMLElement;
  signal: AbortSignal;
  host: Host;
}): Awaitable<void | (() => Awaitable<void>)>;
```

Executed once per view. Receives:

- `model`: the [model interface](#model-interface).
- `el`: an `HTMLElement` to render into.
- `signal`: an `AbortSignal` the host MUST abort when the view is removed.
- `host`: a [`Host`](#widget-composition) for resolving child widgets.

`render` MAY return a cleanup function. Hosts MUST run it when `signal` aborts.

### Cleanup

New code SHOULD prefer `signal` over a returned callback. `signal` composes
with web platform APIs that already accept an `AbortSignal`
(`addEventListener`, `fetch`):

```js
export default {
  render({ model, el, signal }) {
    el.addEventListener(
      "click",
      () => {
        /* ... */
      },
      { signal },
    );
    let onChange = () => {
      /* ... */
    };
    model.on("change:value", onChange);
    signal.addEventListener("abort", () => model.off("change:value", onChange));
  },
};
```

Returned cleanup callbacks remain supported. Hosts MUST wire any returned
callback to run when the corresponding `signal` aborts; a returned callback
and the signal are not two independent cleanup channels. Calling
`signal.aborted` after a hook returns MUST observe the same `aborted` state
that triggers the cleanup.

### Errors

If a lifecycle hook throws (or its returned promise rejects), the host MUST:

1. Treat the hook's phase as failed and not advance to the next phase.
2. Abort the corresponding `signal` (which runs any cleanup wired through it).
3. Surface the error on the host's diagnostic channel.

A widget whose `initialize` failed SHOULD be considered unusable; subsequent
attempts to render its view SHOULD fail visibly rather than retry silently.

### Hot module replacement

A host MAY support hot module replacement (HMR), in which the widget's source
module is replaced at runtime without destroying the model. When HMR occurs
the host MUST:

1. Abort the previous `initialize`'s `signal` (which transitively aborts every
   view `signal` derived from it).
2. Load the replacement module.
3. Run the new module's `initialize`.
4. Re-render any active views with the new `render`.

This sequence preserves model state across HMR while ensuring the previous
module's cleanup runs before any new code touches the widget.

## Model interface

The `model` interface in AFM is loosely based on traditional Jupyter Widgets
but defines a [_narrower_ subset of APIs](https://observablehq.com/@manzt/afm-narrowing-widget-front-end-apis).
This approach maintains familiarity for widget developers while requiring host
platforms to implement only a small subset of APIs to be a proper host.

```typescript
/**
 * The model interface for an Anywidget Front-End Module
 * @see {https://github.com/manzt/anywidget/tree/main/packages/types} for complete types
 */
interface AnyModel {
  /** Get a property value from the model */
  get(key: string): any;
  /** Set a property value in the model */
  set(key: string, value: any): void;
  /** Remove an event listener */
  off(eventName?: string | null, callback?: Function | null): void;
  /** Listen for custom messages from the host */
  on(eventName: "msg:custom", callback: (msg: any, buffers: DataView[]) => void): void;
  /** Listen for property changes (callback receives no arguments) */
  on(eventName: `change:${string}`, callback: () => void): void;
  /** Commit any pending changes to the host */
  save_changes(): void;
  /** Send a custom message to the host */
  send(content: any, callbacks?: any, buffers?: ArrayBuffer[] | ArrayBufferView[]): void;
}
```

**`change:` callback signature.** The `change:` event callback takes no
arguments. To read the current value within a callback, use `model.get()`:

```js
model.on("change:count", () => {
  let count = model.get("count");
  console.log("count changed to", count);
});
```

Some host platforms (e.g., Jupyter via Backbone.js) may pass extra arguments
to the callback as a side effect of their underlying framework. Those extra
arguments are **not** part of AFM. Widget authors MUST NOT rely on them.

**`experimental.invoke`.** Some hosts expose an additional `experimental` prop
on `initialize` and `render` that includes an `invoke(name, msg, opts)` method
for issuing typed RPC-style messages to the host. This surface is provider-
specific and is **not** part of the AFM specification at this revision.

This interface can be implemented without dependencies and does not require
extending [Jupyter Widget's patch of BackboneJS](https://github.com/jupyter-widgets/ipywidgets/blob/main/packages/base/src/backbone-patch.ts).
For instance, marimo's `model` implementation uses
[no third-party dependencies](https://github.com/marimo-team/marimo/blob/7f3023ff0caef22b2bf4c1b5a18ad1899bd40fa3/frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx#L161-L267).

## Widget composition

A widget MAY render and interact with other widgets on the same page. The
`host` prop on `render` exposes two methods for resolving a
[widget reference](#widget-references) into a usable handle.

### Widget references

A widget reference is a string of the form `"anywidget:<model_id>"`. References
MAY appear at any position in synced state: as the value of a top-level trait,
inside a list, or inside a dict. The host MUST be able to recover the
referenced model from the trailing model_id portion of the string.

How references end up in synced state is the responsibility of whatever
serialization layer writes the wire data, not of AFM itself. Hosts that
integrate with the `anywidget` Python package can rely on it to auto-detect
Python objects exposing a `model_id` attribute (or implementing the anywidget
descriptor protocol via `MimeBundleDescriptor`) and emit reference strings
on their behalf.

### `host.getWidget` / `host.getModel`

```typescript
interface Host {
  getWidget<T = unknown>(
    ref: string,
  ): Promise<{
    exports: T;
    render(opts: { el: HTMLElement; signal?: AbortSignal }): Promise<void>;
  }>;
  getModel<T = unknown>(ref: string): Promise<AnyModel<T>>;
}
```

`host.getWidget(ref)`:

- Awaits the child's `initialize` before resolving.
- Returns a handle exposing the child's [exports](#exports) and a `render`
  function bound to that child's view.

`host.getModel(ref)`:

- Returns the child's underlying `AnyModel` for direct event subscriptions or
  `get` / `set` / `send` access without participating in rendering.

`host` is available on `render` only. It is NOT provided to `initialize`. This
restriction prevents parent/child `initialize` ordering hazards (a parent
attempting to resolve a child whose own `initialize` has not yet started).

The child's `render` SHOULD receive the parent's `signal` so that aborting the
parent's view tears the child's view down too.

#### Example

```python
class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    control = anywidget.WidgetTrait().tag(sync=True)

Dashboard(control=Slider(value=50))
```

```js
// slider.js
export default {
  initialize({ model }) {
    return {
      getValue: () => model.get("value"),
      onChange: (cb) => model.on("change:value", cb),
    };
  },
  render({ model, el, signal }) {
    /* ...build a slider DOM element, wire signal cleanup... */
  },
};

// dashboard.js
export default {
  async render({ model, el, signal, host }) {
    let slider = await host.getWidget(model.get("control"));
    if (typeof slider.exports?.onChange === "function") {
      slider.exports.onChange(() =>
        console.log("value:", slider.exports.getValue()),
      );
    }
    let div = document.createElement("div");
    el.appendChild(div);
    await slider.render({ el: div, signal });
  },
};
```

### Exports

`initialize` MAY return an object, which the host stores and exposes as
`exports` on the handle returned by `host.getWidget`. AFM does not impose any
schema on exports. Widget authors define their own interfaces and consumers
duck-type at the boundary.

If a widget's `initialize` returns nothing (or returns a cleanup function),
`exports` MUST be `undefined` on the resolved handle.

### Slot reassignment

When a widget-valued trait is reassigned at runtime (e.g., a Python parent
sets `dashboard.control = different_slider`), the parent's
`change:<trait>` event fires with the new reference string. The parent
SHOULD re-resolve the new reference via `host.getWidget` and tear down any
child views it previously rendered. The simplest pattern is to derive a
per-resolution `AbortController` from the parent's `signal` and abort it on
each `change:` event:

```js
async render({ model, el, signal, host }) {
  let current = new AbortController();
  signal.addEventListener("abort", () => current.abort());
  let mount = async () => {
    current.abort();
    current = new AbortController();
    let combined = AbortSignal.any([signal, current.signal]);
    let child = await host.getWidget(model.get("control"));
    let div = Object.assign(document.createElement("div"), { /* ... */ });
    el.replaceChildren(div);
    await child.render({ el: div, signal: combined });
  };
  await mount();
  model.on("change:control", mount);
}
```

### Errors

Hosts MUST surface composition failures with descriptive errors rather than
silently broken handles:

- **Malformed refs**: `host.getWidget` and `host.getModel` MUST reject when
  given a value that is not a recognized reference string. The rejection
  SHOULD include the offending value.
- **Unknown model**: when the model_id in a reference does not resolve to a
  known model, both methods MUST reject with an error naming the unresolved
  id.
- **Stalled `initialize`**: hosts SHOULD apply a timeout to `host.getWidget`
  and reject if the child's `initialize` does not complete within a
  reasonable time. (The reference implementation uses 10 seconds.)

Hosts that do not implement composition SHOULD still expose `host` on `render`
and have its methods reject with a descriptive error. Omitting `host`
entirely changes the prop signature seen by widget code; rejecting from
`getWidget` keeps the signature uniform and surfaces the limitation cleanly.

### Circular references

`host.getWidget(A)` from inside B's `render` and `host.getWidget(B)` from
inside A's `render` will deadlock, since each parent waits for the other's
`initialize` to complete before its own can proceed. Circular composition
chains are not supported.

## Host requirements

Consolidated normative checklist for an AFM-compatible host implementation.

A host MUST:

1. Load AFM modules as web-standard ECMAScript modules.
2. Implement the [model interface](#model-interface) for each widget instance.
3. Run `initialize` once per instance, awaiting its result before any
   `render` call for that instance.
4. Run `render` once per view, providing `model`, `el`, an `AbortSignal`
   (`signal`), and a [`Host`](#widget-composition) (`host`).
5. Abort the supplied `signal` when the corresponding lifecycle ends (widget
   destroyed for `initialize`, view removed for `render`).
6. Run any cleanup function returned from a lifecycle hook when that hook's
   `signal` aborts. The returned callback and the signal MUST NOT be treated
   as two independent cleanup channels.
7. Maintain a registry of widget bindings keyed by model, so that
   [widget references](#widget-references) can be resolved into their
   `exports` and view `render`.
8. Resolve widget references (`"anywidget:<model_id>"`) passed to
   `host.getWidget` / `host.getModel`. Reject with descriptive errors on
   malformed refs, unknown models, or stalled child `initialize` (see
   [Composition errors](#errors-1)).
9. Cascade view teardown: descendant views rendered with a parent's `signal`
   SHOULD tear down when that parent signal aborts.

A host SHOULD:

- Surface lifecycle hook errors on a diagnostic channel rather than swallowing
  them.
- Apply a timeout to `host.getWidget` to avoid hung promises when a child's
  `initialize` never resolves.

A host MAY:

- Support [hot module replacement](#hot-module-replacement) for the widget's
  source module.
- Expose additional, host-specific surfaces (e.g., `experimental.invoke`).
  These are outside the AFM specification at this revision and MUST NOT
  collide with documented prop names.

## Framework Bridges

AFM intentionally does not prescribe specific models for state management or
UI rendering. While many front-end tools exist to help with authoring UIs
(e.g., React, Svelte, Vue) we strongly believe that incorporating these
non-web-standard pieces at the specification level would be a mistake. Our
goal is to create a solution for reusable widgets that aligns with the web's
strong backwards compatibility guarantees.

Instead of baking framework support into the specification, we envision
support for UI frameworks through:

- **Framework bridges**: libraries that provide idiomatic APIs for popular
  frameworks while adhering to the AFM specification.
- **Developer tooling**: simple build processes that compile
  framework-specific code into standard AFM.

This approach lets anywidget developers use their preferred tools and
frameworks while ensuring the final output is web-standard JavaScript.

For example, using the `@anywidget/react` bridge looks like this:

```jsx
// index.jsx
import * as React from "react";
import { useModelState, createRender } from "@anywidget/react";

function Counter() {
  let [count, setCount] = useModelState("count");
  return <button onClick={() => setCount(count + 1)}>Count is {count}</button>;
}

export default {
  render: createRender(Counter),
};
```

The bridge provides an idiomatic
[_hook_](https://react.dev/reference/react/hooks) for model state
(`useModelState`); `createRender` wraps a React component so it adheres to
the AFM specification.

By keeping framework support outside the core specification, AFM stays
flexible, future-proof, and aligned with the long-term evolution of web
standards.
