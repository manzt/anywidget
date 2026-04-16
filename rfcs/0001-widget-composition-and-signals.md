# RFC: Widget Composition and Signal-Based Lifecycle

**Author:** Trevor Manz &middot; **Created:** 2026-04-02

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to
be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Summary

Three additions to the AFM specification:

1. **`signal`** — `AbortSignal` for lifecycle cleanup in `initialize` and `render`.
2. **Widget exports** — `initialize` MAY return an object that becomes the widget's public interface for composition.
3. **`host`** — a new prop on `render` with `getWidget(ref)` and `getModel(ref)` to resolve a child widget (its exports and `render`) or its underlying model.

Python side: any object that adheres to the **anywidget protocol** (`MimeBundleDescriptor`) or extends `anywidget.AnyWidget` is automatically serializable as a widget reference. A `WidgetTrait` traitlet validates anywidget-compatible values, and `anywidget.Widget` is exported as a type alias for annotations.

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

When both a return callback and `signal` are present, the host MUST wire the return callback to run as part of the signal's `abort` event — i.e., signal abort triggers the cleanup callback.

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

Any object that implements the anywidget protocol (has a `MimeBundleDescriptor` at `_repr_mimebundle_`) or extends `anywidget.AnyWidget` (which exposes `model_id`) can be used directly as a widget reference. The serialization layer auto-detects these objects when building the state payload and replaces them with a ref string. This mirrors how `remove_buffers` already auto-detects binary types (`bytes`, `memoryview`) without explicit declaration.

Detection recurses into nested dicts, lists, and tuples so that widgets can live anywhere in the state tree.

```python
import anywidget

class Dashboard(anywidget.AnyWidget):
    _esm = "dashboard.js"
    # WidgetTrait validates that the value is anywidget-compatible
    header = anywidget.WidgetTrait().tag(sync=True)

# dataclass / pydantic / msgspec — just use the type annotation
@dataclass
class Dashboard:
    _repr_mimebundle_ = anywidget.MimeBundleDescriptor(...)
    header: anywidget.Widget | None = None
```

`anywidget.WidgetTrait` is a traitlet that accepts any anywidget-compatible object (or `None` by default). `anywidget.Widget` is exported as a type alias (the `AnywidgetProtocol`) for type annotations — it has no runtime effect beyond typing.

**Wire format** — widget references are serialized as plain strings of the form `"anywidget:<model_id>"` and embedded directly in the state at the position the object occupied. No separate bucket, no reserved key:

```json
{
  "state": {
    "value": 42,
    "header": "anywidget:aaa...",
    "layout": { "left": "anywidget:bbb...", "right": null }
  }
}
```

`model.get("header")` on the JS side returns the ref string directly; `host.getWidget(ref)` (§4) resolves it to a `{ exports, render }` handle. This keeps state flat, round-trips through existing `update` / `buffer_paths` infrastructure unchanged, and works for nested positions without special-casing.

### 4. `host.getWidget` / `host.getModel`

A new `host` prop on `render` exposes two methods for resolving widget references. Both are async and take a ref string (the value read from `model.get(key)` for a synced widget trait).

- `host.getWidget(ref)` — waits for the child's `initialize` to complete, then returns `{ exports, render }`.
- `host.getModel(ref)` — returns the child's underlying `AnyModel` for lower-level access (event subscriptions, `.get`/`.set`, `.send`).

```js
async render({ model, el, signal, host }) {
  let child = await host.getWidget(model.get("header"));

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

`host` is only available on `render`, not `initialize`. Composition is a view-time concern, and withholding `host` from `initialize` avoids ordering dependencies between parent/child `initialize` calls (see Open Questions in the original draft).

> **Intent:** `host` is a new namespace (separate from `experimental`) to validate
> the composition API. The long-term goal is to promote `getWidget` / `getModel`
> to first-class `AnyModel` methods (e.g., `model.getWidget`).

**Slot reassignment.** When a widget-valued trait changes at runtime (e.g., Python reassigns `dashboard.header = different_widget`), `change:header` fires on the model with a new ref string. The parent should re-resolve via `host.getWidget` and clean up previous child views via its own signal/abort logic.

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
};

interface ResolvedWidget<T = unknown> {
  exports: T;
  render(opts: { el: HTMLElement; signal?: AbortSignal }): Promise<void>;
}

interface Host {
  getWidget<T = unknown>(ref: string): Promise<ResolvedWidget<T>>;
  getModel<T extends ObjectHash = ObjectHash>(ref: string): Promise<AnyModel<T>>;
}

interface InitializeProps<T extends ObjectHash = ObjectHash> {
  model: AnyModel<T>;
  signal: AbortSignal;
  experimental: Experimental;
}

interface RenderProps<T extends ObjectHash = ObjectHash> {
  model: AnyModel<T>;
  el: HTMLElement;
  signal: AbortSignal;
  host: Host;
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
    control = anywidget.WidgetTrait().tag(sync=True)

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
  async render({ model, el, signal, host }) {
    let control = await host.getWidget(model.get("control"));
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

**Why `signal` over return callbacks?** Collapses setup/teardown, composes with browser APIs. Return callbacks still work for backward compat — they are wired as `abort` listeners on the signal, so cleanup runs when the signal fires.

**Why `initialize` returns exports (not `render`)?** `initialize` runs once per instance; `render` runs per view. Exports are per-instance. `render` accesses shared state via closures (factory pattern).

**Why freeform exports?** VS Code proves duck-typed extension APIs scale. No schema validation — widget authors define interfaces, consumers type-check at the boundary.

**Why a `host` namespace (for now)?** Composition is a new capability that touches lifecycle, rendering, and cross-widget coordination. A dedicated `host` prop makes the surface legible — `experimental` is for unstable pre-AFM APIs, `host` is for capabilities the host runtime provides to a widget. The long-term goal is to promote `getWidget` / `getModel` to `AnyModel` methods once the design settles.

**Why ref string, not trait name?** `model.get(key)` already returns the ref string — forwarding that value to `host.getWidget` keeps the JS API uniform with every other synced trait. Widgets never have to know that a particular key is "special." It also means a widget can resolve refs that live anywhere in state (including nested positions, values in dicts/lists), not just top-level traits.

**Why `getModel` alongside `getWidget`?** `getWidget` waits for `initialize` and returns a rendered handle — the right API for view composition. `getModel` is the escape hatch for widgets that need raw model access (subscribing to events, reading state) without participating in rendering. Both are thin wrappers over the same ref-string resolution.

**Why no list slots?** `children: list[Widget]` on the wire works today (auto-detection recurses), but the JS-side ergonomics (diffing, keying, efficient updates) are unresolved. Deferred to a future RFC that focuses on that problem.

**Why auto-detect instead of an explicit wrapper type?** Objects that adhere to the anywidget protocol (have a `MimeBundleDescriptor`) or extend `AnyWidget` already carry enough information for serialization. The serialization layer detects these objects directly, mirroring how `remove_buffers` auto-detects binary types. `WidgetTrait` is provided for traitlets validation (so assigning a non-widget raises at assignment time), and `anywidget.Widget` is a type alias for annotations.

**Circular resolution** deadlocks. Documented limitation — circular deps are a design smell.

**HMR** cascades via signal chain. Parent re-renders, re-resolves, gets fresh `{ exports, render }`.

## Host Requirements

1. Maintain a registry of widget bindings keyed by model (comm ID).
2. Auto-detect anywidget-protocol objects anywhere in state (recursing into dicts, lists, and tuples) and serialize each one as the string `"anywidget:<model_id>"` at its position in the state tree.
3. Parse ref strings passed to `host.getWidget` / `host.getModel` and look up the corresponding model.
4. Wait for the child's `initialize` to complete before resolving `host.getWidget`.
5. Create an `AbortController` per view; cascade abort when a parent view is torn down.
6. Hosts that do not support widget composition should reject `host.getWidget` with a descriptive error.

## Open Questions

1. **Framework bridges** — `useWidget()` hook, `<Widget>` component, etc. Separate RFC.
2. **List-valued slots** — diffing, keying, updates. The wire format already supports widget refs in lists; the open question is the JS-side ergonomics. Future RFC.
3. **`requires` declaration** — module declares needed host capabilities. Deferred.
4. **Cleanup ordering** — return callback before signal abort, or vice versa? Current implementation wires the return callback as an `abort` listener on the signal, so they fire together as part of the same event.
5. ~~**`getWidget` in `initialize`**~~ — resolved: `host` is only available on `render`, so children cannot be resolved during `initialize`. This sidesteps the parent/child `initialize` ordering problem.
6. **Promoting `host` to `model`** — once the design settles, promote `getWidget` / `getModel` to `AnyModel` methods (`model.getWidget(ref)`), and potentially drop the `host` prop.
