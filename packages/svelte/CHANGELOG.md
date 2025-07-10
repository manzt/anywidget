# @anywidget/svelte

## 0.1.0

### Minor Changes

- Migrate to Svelte 5 signals API ([#869](https://github.com/manzt/anywidget/pull/869))

  **This release deliberately contains backwards-incompatible changes.** To avoid automatically picking up releases like this, you should either be pinning the exact version of `@anywidget/svelte` in your `package.json` file or be using a version range syntax that only accepts patch upgrades such as `~0.0.1`.

  The `@anywidget/svelte` now uses Svelte 5's new runes reactivity system (aka signals). The context-based implementation has been replaced with reactive model bindings using `createSubscriber`.

  Update your Svelte dependency to version 5:

  ```bash
  npm install svelte@^5.0.0
  ```

  Ensure Svelte 5 runes are enabled in your bundler configuration:

  ```js
  // rolldown.config.js or rollup.config.js
  svelte({
    compilerOptions: {
      runes: true,
    },
  });
  ```

  The previous API used Svelte 4 and exposed model values via the `stores` proxy:

  ```svelte
  <script>
    import { stores } from "@anywidget/svelte";
    let { count } = stores;
  </script>

  <button on:click={() => $count += 1}>Count is {$count}</button>
  ```

  With Svelte 5, `@anywidget/svelte` now uses direct reactive bindings and the `$props()` rune:

  ```
  <script>
    /** @type {{ bindings: { count: number } }} */
    let { bindings } = $props();
  </script>

  <button on:click={() => bindings.count++}>Count is {bindings.count}</button>
  ```

  This is a **breaking change**. The old stores API and getContext-based access are no longer supported. You must update your components to use the new bindings prop via `$props()`.

  See [manzt/ipyfoo-svelte](https://github.com/manzt/ipyfoo-svelte) for a complete example.

## 0.0.10

### Patch Changes

- Updated dependencies [[`9c10efe9fd44f779fc2a5821c0e6a28ab0f4edad`](https://github.com/manzt/anywidget/commit/9c10efe9fd44f779fc2a5821c0e6a28ab0f4edad)]:
  - @anywidget/types@0.2.0

## 0.0.9

### Patch Changes

- Ensure all src files are included in the package release ([#666](https://github.com/manzt/anywidget/pull/666))

## 0.0.8

### Patch Changes

- Updated dependencies [[`a4b0ec07b2b8937111487108e9b82daf3d9be2df`](https://github.com/manzt/anywidget/commit/a4b0ec07b2b8937111487108e9b82daf3d9be2df)]:
  - @anywidget/types@0.1.9

## 0.0.7

### Patch Changes

- Updated dependencies [[`0c629955fee6379234fece8246c297c69f51ee79`](https://github.com/manzt/anywidget/commit/0c629955fee6379234fece8246c297c69f51ee79)]:
  - @anywidget/types@0.1.8

## 0.0.6

### Patch Changes

- Updated dependencies [[`777fc268ee06fcf13e48a1c00cfdf90c14d786dc`](https://github.com/manzt/anywidget/commit/777fc268ee06fcf13e48a1c00cfdf90c14d786dc)]:
  - @anywidget/types@0.1.7

## 0.0.5

### Patch Changes

- Updated dependencies [[`9aa8dcc8558e00e33fbe4506b68ae30113df3728`](https://github.com/manzt/anywidget/commit/9aa8dcc8558e00e33fbe4506b68ae30113df3728)]:
  - @anywidget/types@0.1.6

## 0.0.4

### Patch Changes

- Updated dependencies [[`6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd`](https://github.com/manzt/anywidget/commit/6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd)]:
  - @anywidget/types@0.1.5

## 0.0.3

### Patch Changes

- fix: broken import in WrapperComponent ([#219](https://github.com/manzt/anywidget/pull/219))

## 0.0.2

### Patch Changes

- feat: use JS Symbols to scope access to Svelte Context ([#215](https://github.com/manzt/anywidget/pull/215))

## 0.0.1

### Patch Changes

- feat: Use Context API to expose `model` and `stores` to components. ([#213](https://github.com/manzt/anywidget/pull/213))
