# @anywidget/signals

> [!WARNING]
> This package is still in development and not ready for production use.

Use [signals](https://github.com/tc39/proposal-signals) with
[anywidget](https://anywidget.dev)

## Usage

```javascript
import { effect, signal } from "@preact/signals-core";
import { defineWidget } from "@anywidget/signals";

export default signalify(signal, {
  render({ model, el }) {
    let btn = document.createElement("button");
    btn.addEventListener("click", () => model.value += 1);
    effect(() => {
      btn.innerText = `Count is ${model.value}`;
    });
    el.appendChild(btn);
  },
});
```

## Explanation

`@anywidget/signals` is an anywidget front-end module (AFM) _bridge_ that
allows you to use various signal implementations with anywidget.

For example, you can use `@preact/signals-core`, `solid-js`, or other
signals-like things to implement the front-end logic for an anywidget:

```python
class Counter(anywidget.Widget):
    _esm = "index.js"
    value = traitlets.Int(0).tag(sync=True)
```

With `@preact/signals-core`:

```typescript
import { effect, signal } from "@preact/signals-core";
import { defineWidget } from "@anywidget/signals";

export default signalify(signal, {
  render({ model, el }) {
    let btn = document.createElement("button");
    btn.addEventListener("click", () => model.value += 1);
    effect(() => {
      btn.innerText = `Count is ${model.value}`;
    });
    el.appendChild(btn);
  },
});
```

With `solid-js`:

```typescript
import { createEffect, createSignal } from "solid-js";
import { defineWidget } from "@anywidget/signals";

export default defineWidget(createSignal, {
  render({ model, el }) {
    let btn = document.createElement("button");
    btn.addEventListener("click", () => model.value += 1);
    createEffect(() => {
      btn.innerText = `Count is ${model.value}`;
    });
    el.appendChild(btn);
  },
});
```

Behind the scenes, `defineWidget` creates a _signal_ for each widget attribute.

> [!IMPORTANT
> The `model` passed into the widget lifecycle methods is _different_ from the
> `model` without the signals bridge.

This `model` is special. In AFM, model state is normally accessed though `.get`
and `.set`/`.save_changes`. With the `@anywidget/signals` bridge, the state is
accessed through fields on the `model`:

```typescript
// without signals bridge
model.get("value"); // 10
model.set("value", 20);
model.save_changes();

// with signals bridge
model.value; // 10
model.value = 20;
```

That's somewhat more convenient, but the real power comes from the ability to
_compose_ signals with the effect system of your choice. For example, we can
create derived signals:

```typescript
import { signal, computed, effect } from "@preact/signals-core";
import { defineWidget } from "@anywidget/signals";

export default defineWidget(signal, {
  render({ model, el }) {
    let doubled = computed(() => model.value * 2);

    let btn = document.createElement("button");
    btn.addEventListener("click", () => model.value += 1);
    effect(() => {
      btn.innerText = `Count is ${model.value}, doubled is ${doubled.value}`;
    });
    el.appendChild(btn);
  },
});
```
