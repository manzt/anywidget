---
"@anywidget/vue": minor
---

Initial release

Thanks to @aryan02420, we now support Vue with an official framework bridge—similar to our React and Svelte bindings.

Unlike `@anywidget/react`, the `useModelState` hook returns a Vue `ShallowRef` that you can update directly (e.g. `value++`), aligning with Vue’s reactivity model.

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
  <button :onClick="() => value++">count is {{ value }}</button>
</template>
```

See the README for build tool configuration.

