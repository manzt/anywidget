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
```

## Bundling

```javascript
// vite.config.js
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue()],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.js'),
			// the proper extensions will be added
			fileName: 'counter-widget',
			formats: ['es'],
		},
	},
});
```

## License

MIT
