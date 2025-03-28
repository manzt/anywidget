# @anywidget/react

## 0.2.0

### Minor Changes

- Use `React.useSyncExternalStore` for `useModelState` hook implementation ([`34f01a3`](https://github.com/manzt/anywidget/commit/34f01a3ebf96621d460e370dfe70c191b3f71bfe))

  The [`React.useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) hook was introduced in React 18 and is designed for external sources of truth, like the anywidget `model`. It ensures a shared source within the component tree, and consistent behavior during concurrent rendering, avoiding subtle bugs present in `useEffect`-based patterns.

  This is marked as a **breaking change** to signal the internal shift in behavior, though in practice it should be considered an improvement. Most users should not notice any difference, aside from more consistent updates.

- Mirror `React.useState` API in `useModelState` hook ([`34f01a3`](https://github.com/manzt/anywidget/commit/34f01a3ebf96621d460e370dfe70c191b3f71bfe))

  Aligns the `useModelState` hook more closely with the `React.useState` API by allowing a callback function in the state setter.

### Patch Changes

- Add generic type parameter to `useModel` hook ([`34f01a3`](https://github.com/manzt/anywidget/commit/34f01a3ebf96621d460e370dfe70c191b3f71bfe))

## 0.1.0

### Minor Changes

- Support React 19 ([#763](https://github.com/manzt/anywidget/pull/763))

## 0.0.8

### Patch Changes

- Updated dependencies [[`9c10efe9fd44f779fc2a5821c0e6a28ab0f4edad`](https://github.com/manzt/anywidget/commit/9c10efe9fd44f779fc2a5821c0e6a28ab0f4edad)]:
  - @anywidget/types@0.2.0

## 0.0.7

### Patch Changes

- Updated dependencies [[`a4b0ec07b2b8937111487108e9b82daf3d9be2df`](https://github.com/manzt/anywidget/commit/a4b0ec07b2b8937111487108e9b82daf3d9be2df)]:
  - @anywidget/types@0.1.9

## 0.0.6

### Patch Changes

- Add `useExperimental` hook ([#524](https://github.com/manzt/anywidget/pull/524))

- Updated dependencies [[`0c629955fee6379234fece8246c297c69f51ee79`](https://github.com/manzt/anywidget/commit/0c629955fee6379234fece8246c297c69f51ee79)]:
  - @anywidget/types@0.1.8

## 0.0.5

### Patch Changes

- Updated dependencies [[`777fc268ee06fcf13e48a1c00cfdf90c14d786dc`](https://github.com/manzt/anywidget/commit/777fc268ee06fcf13e48a1c00cfdf90c14d786dc)]:
  - @anywidget/types@0.1.7

## 0.0.4

### Patch Changes

- Updated dependencies [[`9aa8dcc8558e00e33fbe4506b68ae30113df3728`](https://github.com/manzt/anywidget/commit/9aa8dcc8558e00e33fbe4506b68ae30113df3728)]:
  - @anywidget/types@0.1.6

## 0.0.3

### Patch Changes

- Updated dependencies [[`6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd`](https://github.com/manzt/anywidget/commit/6608992b8fe3a9f4eb7ebb2c8c5533febf26f4dd)]:
  - @anywidget/types@0.1.5

## 0.0.2

### Patch Changes

- feat: add 'useModel' hook ([#200](https://github.com/manzt/anywidget/pull/200))

## 0.0.1

### Patch Changes

- fix: specify "types" field in package.json ([#198](https://github.com/manzt/anywidget/pull/198))
