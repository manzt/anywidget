# @anywidget/vue

> Vue utilities for [**anywidget**](https://anywidget.dev)

## Installation

```sh
npm install @anywidget/vue
```

## Usage

```javascript
// src/index.js
import { createRender } from "@anywidget/vue";
import CounterWidget from "./CounterWidget.vue";

const render = createRender(CounterWidget);

export default { render };
```

```vue
<!-- src/CounterWidget.vue -->
<script setup>
import { useModelState } from "@anywidget/vue";

const value = useModelState("value");
</script>

<template>
<button :onClick="() => value++">count is {{value}}</button>
</template>

<style scoped>
</style>
```

## Bundlers

You'll need to compile the above source files into a single ESM entrypoint for
**anywidget** with a bundler.

### Vite

We currently recommend using [Vite](https://vite.dev/) in [library mode](https://vite.dev/guide/build.html#library-mode).

```sh
pnpm add -D @types/node @vitejs/plugin-vue vite
```

```javascript
// vite.config.js
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "js/CounterWidget.ts"),
			// the proper extensions will be added
			fileName: "counter-widget",
			formats: ["es"],
		},
		// minify: false, // Uncomment to make it easier to debug errors.
	},
	define: {
		// DOCS: https://vite.dev/guide/build.html#css-support
		// > In library mode, all import.meta.env.* usage are statically replaced when building for production.
		// > However, process.env.* usage are not, so that consumers of your library can dynamically change it.
		//
		// The consumer of the widget is a webview, which does not have a top level process object.
		// So we need to replace it with a static value.
		'process.env.NODE_ENV': '"production"',
	},
});
```

```sh
vite build
```

You can read more about using Vite with **anywidget** in
[our documentation](https://anywidget.dev/en/bundling/#vite).

## License

MIT
