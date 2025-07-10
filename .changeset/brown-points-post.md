---
"@anywidget/svelte": minor
---

Migrate to Svelte 5 signals API

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
