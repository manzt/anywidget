---
"@anywidget/svelte": patch
---

Remove optional markers from `defineWidget` component props in JSDoc type annotation, so `model` and `bindings` are correctly typed as required (they are always provided in the render method).
