# @anywidget/svelte

> Svelte utilities for [**anywidget**](https://anywidget.dev)

## Installation

> **Warning**
> This API is currently experimental an subject to change.

```sh
npm install @anywidget/svelte
```

## Usage

```javascript
// index.js
import { createRender } from "@anywidget/svelte";
import Counter from "./Counter.svelte";

export let render = createRender(Counter);
```

```svelte
<!-- Counter.svelte -->
<script>
    import { stores } from "@anywidget/svelte";
    // Access traitlet values as Svelte stores
    let { count } = stores;
</script>

<button on:click={() => $count += 1}Count is {$count}</button>
```

```sh
rollup -p @rollup/plugin-node-resolve -p rollup-plugin-svelte index.js > bundle.js
```

## License

MIT
