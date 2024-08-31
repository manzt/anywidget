---
title: "Anywidget Front-End Module (AFM)"
description: "A specification for portable widgets based on ECMAScript modules."
layout: ../../layouts/MainLayout.astro
---

## What is AFM?

The **Anywidget Front-End Module (AFM)** specification defines a standard for
creating portable widget front-end code. Our vision is to enable widget reuse
within and **beyond Jupyter**, including other computational notebooks and standalone web
applications. AFM is oriented around a minimal set of APIs we identified as
essential for integration with [_host platforms_](#host-platform), boiling down to:

- Bidirectional communication with a host (e.g., Jupyter)
- Modifying output areas (DOM manipulation) (e.g., a notebook output cell)

## Core Concepts

### Front-End Module

The Anywidget Front-end Module is widget front-end code authored by a widget
developer. It contains the front-end logic of a widget, which is defined by
implementing various [lifecycle methods](#lifecycle-methods) to control the
widget's behavior. AFM is a web-standard ECMAScript module (ESM) can be
authored simply as a text file or generated from a more complex front-end
toolchain.

### Host platform

The web-based environment in which a widget is embedded. It is responsible for
loading AFM and calling [lifecycle methods](#lifecycle-methods) with required
the platform APIs.

The `anywidget` Python library provides the necessary glue code to make all
Jupyter-like environments (e.g., Jupyter Notebook, JupyterLab, Google Colab, VS
Code) an AFM-compatible host platform. The
[marimo](https://github.com/marimo-team/marimo) project is an example of a _native_ host
platform.

## Anywidget Front-end Module (AFM)

An Anywidget Front-End Module (AFM) is an [ECMAScript
module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
that defines a widget's behavior through [lifecycle
methods](#lifecycle-methods).

```js
export default {
  initialize({ model }) {
    // Set up shared state or event handlers.
    return () => {
      // Optional: Called when the widget is destroyed.
    } 
  },
  render({ model, el }) {
    // Render the widget's view into the el HTMLElement.
    return () => {
      // Optional: Called when the view is destroyed.
    }
  }
}
```

A host platform is expected to:

- Load this module.
- Call the lifecycle methods, passing in dependencies (`model` & `el`).

All browsers support ECMAScript modules, so loading the module is supported natively across
web-based environments. It is then the host platform's responsibility to
implement the required [`model` interface](#model-interface) and provide an
output DOM element (`el`). This simple mechanism allows new host platforms to
be implemented as long as they adhere to these requirements.

### Lifecycle Methods

The widget lifecycle in AFM follows a Model-View pattern, consisting of two
main phases:

- **Model Initialization**: Occurs when a widget is first created, setting up
the model and any shared state.
- **View Rendering**: Happens each time a widget needs to be displayed,
potentially multiple times for a single widget instance.

AFM exports methods that correspond to these lifecycle phases. The default
export object specifies one or more widget lifecycle hooks:

- `initialize({ model })`: Executed once per widget instance during model
initialization. It has access to `model` to setup non-view event handlers or
state to share across views.

- `render({ model, el })`: Executed once per view during view rendering. It has
access to both the `model` and an `el` DOM element. Used to setup event
handlers or access state specific to that view.

Each method MAY return a **cleanup function** which will be called when the
widget is destroyed or the view is removed.

#### Additional Setup Logic

The default export may also be a function that returns this interface. This
option can be useful to setup some front-end specific state for the lifecycle
of the widget:

```js
export default async () => {
  let extraState = {};
  return {
    initialize({ model }) { /* ... */ },
    render({ model, el }) { /* ... */ },
  }
}
```

Here, `initialize` and `render` both will have access to `extraState` during the
lifetime of the widget.

### Model interface

The `model` interface in AFM is loosely based on traditional Jupyter Widgets but
defines a [_narrower_ subset of
APIs](https://observablehq.com/@manzt/afm-narrowing-widget-front-end-apis).
This approach maintains familiarity for widget developers while requiring host
platforms to implement a small subset of APIs to be a proper host.

The simplified interface is:

```typescript
/**
 * The model interface for an Anywidget Front-End Module
 * @see {https://github.com/manzt/anywidget/tree/main/packages/types} for complete types
 */
interface AnyModel {
  /** Get a property value from the model
   * @param key The key of the property to get
   * @returns The value of the property
   */
  get(key: string): any;
  /**
   * Set a property value in the model
   * @param key The key of the property to set
   * @param value The value to set
   */
  set(key: string, value: any): void;
  /**
   * Remove an event listener
   * @param eventName The name of the event to stop listening to
   * @param callback The callback function to remove
   */
  off(eventName?: string | null, callback?: Function | null): void;
  /**
   * Add an event listener for custom messages
   * @param eventName Must be "msg:custom"
   * @param callback The function to call when a custom message is received
   */
  on(eventName: "msg:custom", callback: (msg: any, buffers: DataView[]) => void): void;
  /**
   * Add an event listener for property changes
   * @param eventName The name of the event, in the format "change:propertyName"
   * @param callback The function to call when the property changes
   */
  on(eventName: `change: ${string}`, callback: Function): void;
  /**
   * Commit changes to sync with the backend
   */
  save_changes(): void;
  /**
   * Send a custom message to the backend
   * @param content The content of the message
   * @param callbacks Optional callbacks for the message
   * @param buffers Optional binary buffers to send with the message
   */
  send(content: any, callbacks?: any, buffers?: ArrayBuffer[] | ArrayBufferView[]): void;
}
```

This interface can be implemented without any dependencies and does not need to
extend from [Jupyter Widget's patch of
BackboneJS](https://github.com/jupyter-widgets/ipywidgets/blob/main/packages/base/src/backbone-patch.ts).
For instance, marimo's `model` implementation uses [no third-party
dependencies](https://github.com/marimo-team/marimo/blob/7f3023ff0caef22b2bf4c1b5a18ad1899bd40fa3/frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx#L161-L267).

## Framework Bridges

AFM intentionally does not prescribe specific models for state management or UI
rendering. While many front-end tools exist to help with authoring UIs (e.g.,
React, Svelte, Vue) we strongly believe that incorporating these
non-web-standard pieces at the specification level would be a mistake. Our goal
is to create a solution for reusable widgets that aligns with the web's strong
backwards compatibility guarantees.

Instead of baking framework support into the specification, we envision support
for UI frameworks through:

- **Framework bridges**: Libraries that provide idiomatic APIs for popular
frameworks while adhering to the AFM specification.
- **Developer tooling**: Simple build processes that can compile
framework-specific code into standard AFM.

This approach gives anywidget developers the option to use their preferred
tools and frameworks while ensuring that the final output is a web-standard
JavaScript.

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
  render: createRender(Counter)
};
```

The bridge provides an idiomatic
[_hook_](https://react.dev/reference/react/hooks) for model state
(`useModelState`) and `createRender` function wraps a React component to
adhere to the AFM specification.

By maintaining this separation between frameworks and the core specification,
we ensure that AFM remains flexible, future-proof, and aligned with the
long-term evolution of web standards.
