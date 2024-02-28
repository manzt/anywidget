# @anywidget/svelte

> Svelte utilities for [**anywidget**](https://anywidget.dev)

## Installation

> **Warning** This API is currently experimental an subject to change. Our plan
> is to migrate to [Svelte 5 with runes](https://svelte.dev/blog/runes) once
> released.

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

<button on:click={() => $count += 1}>Count is {$count}</button>
```

## Bundlers

You'll need to compile the above source files into a single ESM entrypoint for
**anywidget** with a bundler.

### Rollup

We currently recommend using [Rollup](https://rollupjs.org/).

```sh
pnpm add -D rollup @rollup/plugin-node-resolve rollup-plugin-svelte
```

```js
// rollup.config.js
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";

export default {
	input: "index.js",
	output: "bundle.js",
	plugins: [svelte({ emitCss: false }), resolve()],
};
```

```sh
rollup -c rollup.config.js --watch
```

### Vite

Alternatively, you can use the **anywidget** [Vite](https://vitejs.dev/) plugin.

```sh
pnpm add -D vite @sveltejs/vite-plugin-svelte @anywidget/vite
```

```js
// vite.config.js
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import anywidget from "@anywidget/vite";

export default defineConfig({
	plugins: [anywidget(), svelte({ hot: false })],
});
```

```sh
vite
```

You can read more about using Vite with **anywidget** in
[our documentation](https://anywidget.dev/en/bundling/#vite).

## Acknowledgements

Special thanks to [Daria Vasyukova](https://github.com/gereleth) for
[the idea](https://twitter.com/gereleth/status/1620164274491654145) and
[Donny Bertucci](https://github.com/xnought) for the
[initial implementation](https://github.com/xnought/svelte-store-anywidget),
which lead to this package.

## License

MIT
