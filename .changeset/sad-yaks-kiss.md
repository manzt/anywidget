---
"@anywidget/react": minor
---

Use `React.useSyncExternalStore` for `useModelState` hook implementation

The [`React.useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) hook was introduced in React 18 and is designed for external sources of truth, like the anywidget `model`. It ensures a shared source within the component tree, and consistent behavior during concurrent rendering, avoiding subtle bugs present in `useEffect`-based patterns.

This is marked as a **breaking change** to signal the internal shift in behavior, though in practice it should be considered an improvement. Most users should not notice any difference, aside from more consistent updates.
