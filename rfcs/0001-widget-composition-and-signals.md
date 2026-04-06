# RFC: Widget Composition and Signal-Based Lifecycle

**Author:** Trevor Manz &middot; **Created:** 2026-04-02

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to
be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Summary

Three additions to the AFM specification:

1. **`signal`** — `AbortSignal` for lifecycle cleanup in `initialize` and `render`.
2. **Widget exports** — `initialize` MAY return an object that becomes the widget's public interface for composition.
3. **`experimental.getWidget`** — resolve a child widget by trait name, get its exports and `render`.

Python side: any object that adheres to the **anywidget protocol** (`MimeBundleDescriptor`) or extends `anywidget.AnyWidget` is automatically serializable as a widget reference. No wrapper type needed.

All changes are backward compatible.

## Motivation

**Signal-based cleanup.** Return callbacks separate setup from teardown. `AbortSignal` collapses them and composes with browser APIs (`addEventListener`, `fetch`):

```js
el.addEventListener("click", handler, { signal }); // cleanup is automatic
```

**Widget composition.** No mechanism exists to render one widget inside another's DOM from JavaScript. This blocks layout widgets, dashboards, and widget toolkits.

**Typed widget protocols.** When composing, a parent needs more than `model.get()`/`model.set()`. A chart might expose `highlight(series)`. A table might expose `scrollToRow(index)`. These are JS-side capabilities that don't map to synced model state — they're the widget's programmatic interface. Like VS Code extensions (where `activate()` returns an `exports` object consumed by other extensions via duck typing), `initialize` returns an exports object that other widgets can inspect and use.

## Design

### 1. `signal`

The host MUST pass an `AbortSignal` to both `initialize` and `render`, and MUST abort it when the widget model is destroyed (`initialize`) or the view is removed (`render`).

New widgets should prefer `signal` over return callbacks for cleanup. Return callbacks are still supported for backward compatibility.

```js
export default {
  render({ model, el, signal }) {
    el.addEventListener(
      "click",
      () => {
        model.set("count", model.get("count") + 1);
        model.save_changes();
      },
      { signal },
    );

    let update = () => {
      el.textContent = model.get("count");
    };
    update();
    model.on("change:count", update);
    signal.addEventListener("abort", () => model.off("change:count", update));
  },
};
```

When both a return callback and `signal` are present, the host MUST invoke the return callback first, then abort the signal.

### 2. `initialize` MAY return exports

`initialize` MAY return an arbitrary object — the widget's **exports**. The host stores it and makes it available via `getWidget`. The name mirrors VS Code's `Extension.exports` and ES module semantics: it's what the widget makes available for others to use.

The host MUST NOT impose constraints on the returned object. Widget authors define their own protocols, and consumers use duck typing to check for support at the boundary. A slider widget might export `getValue`/`setValue`. A map widget might export `panTo(lat, lng)`. A data widget might export nothing at all. The contract is between the widget author and the consumer, not enforced by the framework.

```js
export default () => {
  let data;
  return {
    initialize({ model, signal }) {
      data = buildReactiveStore(model, { signal });
      // The returned object is this widget's exports.
      // Other widgets that resolve this one via getWidget
      // can inspect and call these methods.
      return {
        getValue: () => data.current,
        setValue: (x) => data.set(x),
        subscribe: (cb) => data.subscribe(cb),
      };
    },
    render({ model, el, signal }) {
      // uses `data` via closure, not the exports
    },
  };
};
```

**Backward compatibility** — the return type of `initialize` is overloaded:

| Return value | Interpretation                                 |
| ------------ | ---------------------------------------------- |
| `void`       | No exports, no cleanup (existing)              |
| `() => void` | Cleanup callback (existing)                    |
| `object`     | Widget exports (new; use `signal` for cleanup) |

The host distinguishes these via `typeof ret === "function"`. Widgets that do not return an object have `exports: undefined` when resolved. No implicit default — exports are strictly opt-in.

> **Note:** If your exports is a single function, wrap it in an object
> (e.g., `{ call: fn }`) to avoid ambiguity with cleanup callbacks.

### 3. Widget references (Python)

Any object that implements the anywidget protocol (has a `MimeBundleDescriptor` at `_repr_mimebundle_`) or extends `anywidget.AnyWidget` can be used directly as a widget reference. The serialization layer auto-detects these objects in top-level state values and produces the appropriate wire format. This mirrors how `remove_buffers` already auto-detects binary types (`bytes`, `memoryview`) without explicit declaration.

Detection is top-level only — the serializer does not recurse into nested structures. Nested and list-valued slots are deferred to a future RFC.

```python
class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    # traitlets — just use Instance(AnyWidget)
    header = traitlets.Instance(anywidget.AnyWidget).tag(sync=True)

# dataclass / pydantic / msgspec — just use the type annotation
@dataclass
class Dashboard:
    _repr_mimebundle_ = anywidget.MimeBundleDescriptor(...)
    header: anywidget.AnyWidget | None = None
```

For type-checking purposes, `anywidget.Slot` MAY be used as a type alias for "any object adhering to the anywidget protocol." It has no runtime behavior — it is purely for annotation:

```python
from anywidget import Slot

@dataclass
class Dashboard:
    _repr_mimebundle_ = anywidget.MimeBundleDescriptor(...)
    header: Slot | None = None  # accepts any anywidget-compatible object
```

**Wire format** — widget references are separated from regular state into a dedicated `_anywidget_slots_` key. They travel in the same `update` messages as all other state, so existing broadcast infrastructure handles them. Slot keys MUST NOT appear in the top-level state — they exist only inside `_anywidget_slots_`:

```json
{
  "state": {
    "value": 42,
    "_anywidget_slots_": {
      "header": "<comm_id>",
      "sidebar": "<comm_id>"
    }
  }
}
```

`_anywidget_slots_` is a reserved key. `model.get()` does not return slot references — `getWidget()` is the only way to access them.

### 4. `experimental.getWidget`

Resolves a child widget by trait name. Async — waits for the child's `initialize` to complete before resolving.

```js
async render({ model, el, signal, experimental }) {
  let child = await experimental.getWidget("header");

  // child.exports is `unknown` — use a type guard to narrow
  if (child.exports && typeof child.exports.setValue === "function") {
    child.exports.setValue(10);
  }

  let container = document.createElement("div");
  el.appendChild(container);
  await child.render({ el: container, signal });
}
```

**Resolved widget shape:**

```ts
interface ResolvedWidget<T = unknown> {
  exports: T;
  render(opts: { el: HTMLElement; signal?: AbortSignal }): Promise<void>;
}
```

Passing the parent's `signal` to `child.render` ties their lifecycles — aborting the parent's signal cascades to the child's view teardown.

> **Intent:** `getWidget` lives on `experimental` to validate the design. The
> long-term goal is `model.getWidget` as a first-class `AnyModel` method.

**Slot reassignment.** When a slot value changes at runtime (e.g., Python reassigns `dashboard.header = different_widget`), `change:header` fires on the model. The parent should re-resolve via `getWidget` and clean up previous child views via its own signal/abort logic.

## Updated Types

```ts
type Experimental = {
  invoke<T>(
    name: string,
    msg?: any,
    options?: {
      buffers?: DataView[];
      signal?: AbortSignal;
    },
  ): Promise<[T, DataView[]]>;
  getWidget(traitName: string): Promise<ResolvedWidget>;
};

interface InitializeProps<T extends ObjectHash = ObjectHash> {
  model: AnyModel<T>;
  signal: AbortSignal;
  experimental: Experimental;
}

interface RenderProps<T extends ObjectHash = ObjectHash> {
  model: AnyModel<T>;
  el: HTMLElement;
  signal: AbortSignal;
  experimental: Experimental;
}

interface Initialize<T extends ObjectHash = ObjectHash> {
  (props: InitializeProps<T>): Awaitable<void | (() => Awaitable<void>) | object>;
}

interface Render<T extends ObjectHash = ObjectHash> {
  (props: RenderProps<T>): Awaitable<void | (() => Awaitable<void>)>;
}

type AnyWidget<T extends ObjectHash = ObjectHash> =
  | { initialize?: Initialize<T>; render?: Render<T> }
  | (() => Awaitable<{ initialize?: Initialize<T>; render?: Render<T> }>);

interface ResolvedWidget<T = unknown> {
  exports: T;
  render(opts: { el: HTMLElement; signal?: AbortSignal }): Promise<void>;
}
```

## Example

```python
import anywidget, traitlets

class Slider(anywidget.AnyWidget):
    _esm = "slider.js"
    value = traitlets.Float(0.0).tag(sync=True)
    min = traitlets.Float(0.0).tag(sync=True)
    max = traitlets.Float(100.0).tag(sync=True)

class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    control = traitlets.Instance(anywidget.AnyWidget).tag(sync=True)

slider = Slider(value=50, min=0, max=100)
Dashboard(control=slider)  # just pass the widget directly
```

**slider.js**

```js
export default () => ({
  initialize({ model, signal }) {
    return {
      getValue: () => model.get("value"),
      setValue: (v) => {
        model.set("value", v);
        model.save_changes();
      },
      onChange: (cb) => {
        model.on("change:value", cb);
      },
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
    model.on("change:value", () => {
      input.value = model.get("value");
    });
    signal.addEventListener("abort", () => model.off("change:value"));
    el.appendChild(input);
  },
});
```

**dashboard.ts**

```ts
interface SliderExports {
  getValue(): number;
  setValue(x: number): void;
  onChange(cb: () => void): void;
}

function isSliderExports(exports: unknown): exports is SliderExports {
  return (
    exports != null &&
    typeof (exports as any).getValue === "function" &&
    typeof (exports as any).setValue === "function"
  );
}

export default {
  async render({ model, el, signal, experimental }) {
    let control = await experimental.getWidget("control");
    // control.exports is `unknown` — narrow with the type guard
    if (isSliderExports(control.exports)) {
      control.exports.onChange(() => console.log("value:", control.exports.getValue()));
    }
    let div = document.createElement("div");
    el.appendChild(div);
    await control.render({ el: div, signal });
  },
};
```

## Design Decisions

**Why `signal` over return callbacks?** Collapses setup/teardown, composes with browser APIs. Return callbacks still work for backward compat. When both present, return callback fires first, then signal aborts.

**Why `initialize` returns exports (not `render`)?** `initialize` runs once per instance; `render` runs per view. Exports are per-instance. `render` accesses shared state via closures (factory pattern).

**Why freeform exports?** VS Code proves duck-typed extension APIs scale. No schema validation — widget authors define interfaces, consumers type-check at the boundary.

**Why `experimental.getWidget` (for now)?** Long-term home is `model.getWidget`. Shipping on `experimental` first to validate before committing to `AnyModel`.

**Why trait name, not raw ID?** Abstracts the wire format. Widget code never sees comm IDs or `_anywidget_slots_` internals.

**Why no list slots?** `children: list[Slot]` requires diffing, keying, efficient updates. Deferred.

**Why auto-detect instead of an explicit wrapper type?** Objects that adhere to the anywidget protocol (have a `MimeBundleDescriptor`) or extend `AnyWidget` already carry enough information for serialization. The serialization layer can detect these objects directly, mirroring how `remove_buffers` auto-detects binary types. `Slot` is provided only as a type alias for annotations.

**Circular resolution** deadlocks. Documented limitation — circular deps are a design smell.

**HMR** cascades via signal chain. Parent re-renders, re-resolves, gets fresh `{ exports, render }`.

## Host Requirements

1. Maintain a registry of widget models by comm ID.
2. Auto-detect anywidget-protocol objects in top-level state and serialize them into `_anywidget_slots_`.
3. Map trait names to comm IDs when `getWidget` is called.
4. Wait for the child's `initialize` to complete before resolving `getWidget`.
5. Create an `AbortController` per view; cascade abort when a parent view is torn down.
6. Hosts that do not support widget composition should reject `getWidget` with a descriptive error.

## Open Questions

1. **Framework bridges** — `useSlot()` hook, `<Slot>` component, etc. Separate RFC.
2. **List-valued slots** — diffing, keying, updates. Future RFC.
3. **`requires` declaration** — module declares needed host capabilities. Deferred.
4. **Cleanup ordering** — return callback before signal abort, or vice versa?
5. **`getWidget` in `initialize`** — should parents be able to resolve children during `initialize` (e.g., to subscribe to a child's exports)? This works but creates ordering dependencies between `initialize` calls. Needs guidance.
