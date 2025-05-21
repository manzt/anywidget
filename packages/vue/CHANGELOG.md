# @anywidget/vue

## 0.1.0

### Minor Changes

- Initial release ([`1c5f07a`](https://github.com/manzt/anywidget/commit/1c5f07a736ec749f3cbad6f1ed3ad55e1ef421a6))

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
