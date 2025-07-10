# @anywidget/svelte

> Svelte utilities for [**anywidget**](https://anywidget.dev)

## Installation

```sh
npm install @anywidget/svelte
```

## Usage

```javascript
// index.js
import { defineWidget } from "@anywidget/svelte";
import Counter from "./Counter.svelte";

export default defineWidget(Counter);
```

```svelte
<!-- Counter.svelte -->
<script>
  /** @type {{ bindings: { value: number }}} */
  let { bindings } = $props();
</script>

<button onclick={() => bindings.value++}>Count is {bindings.value}</button>
```

## Bundlers

You'll need to compile the above source files into a single ESM entrypoint for
**anywidget** with a bundler.

### Rolldown

We recommend using [Rolldown](https://rolldown.rs/) for bundling Svelte 5 components.

```sh
pnpm add -D rolldown rollup-plugin-svelte
```

```js
// rolldown.config.js
import { defineConfig } from "rolldown";
import svelte from "rollup-plugin-svelte";

export default defineConfig({
  input: "./index.js",
  output: {
    dir: "./dist/",
  },
  plugins: [
    svelte({ compilerOptions: { runes: true } }),
  ],
});
```

```sh
rolldown -c
```

See [manzt/ipyfoo-svelte](https://github.com/manzt/ipyfoo-svelte) for a
complete example.

## Acknowledgements

Special thanks to [Daria Vasyukova](https://github.com/gereleth) for
[the idea](https://twitter.com/gereleth/status/1620164274491654145) and
[Donny Bertucci](https://github.com/xnought) for the
[initial implementation](https://github.com/xnought/svelte-store-anywidget),
which lead to this package.

## License

MIT
