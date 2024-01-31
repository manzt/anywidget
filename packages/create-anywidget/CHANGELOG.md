# create-anywidget

## 0.5.0

### Minor Changes

- Migrate to widget lifecycle hooks ([#425](https://github.com/manzt/anywidget/pull/425))

## 0.4.5

### Patch Changes

- feat: Add example.ipynb to all projects ([#414](https://github.com/manzt/anywidget/pull/414))

- feat: Rename template options with additional hints ([#415](https://github.com/manzt/anywidget/pull/415))

## 0.4.4

### Patch Changes

- Bump `@types/react-dom` ([#390](https://github.com/manzt/anywidget/pull/390))

## 0.4.3

### Patch Changes

- Update React dependency version ([#370](https://github.com/manzt/anywidget/pull/370))

## 0.4.2

### Patch Changes

- Upgrade dependencies ([`01a79f6`](https://github.com/manzt/anywidget/commit/01a79f68cee37747ff0d480ebbefcc9697837180))

## 0.4.1

### Patch Changes

- fix: correctly detect bun as package manager ([#282](https://github.com/manzt/anywidget/pull/282))

## 0.4.0

### Minor Changes

- feat: Support Bun and prefer built-in bundler over `esbuild` ([#269](https://github.com/manzt/anywidget/pull/269))

  When running `bun create anywidget@latest`, the resulting package.json scripts
  prefer the built-in bundler over esbuild. As a result, the vanilla JS template
  has no dependencies.

  ```sh
  bun create anywidget@latest
  ```

## 0.3.0

### Minor Changes

- feat: unify templating system within `create.js` ([#263](https://github.com/manzt/anywidget/pull/263))

  Allows for more dynamic templates and sharing of common Python setup between templates.

## 0.2.1

### Patch Changes

- feat: use `src/my_widget/static` directory for build assets ([`6e2cc42`](https://github.com/manzt/anywidget/commit/6e2cc42da5893576eb3007455966ad9fa709fe9c))

- fix: point esbuild to source in js folder ([#260](https://github.com/manzt/anywidget/pull/260))

## 0.2.0

### Minor Changes

- feat: move `package.json` to template root directories ([#256](https://github.com/manzt/anywidget/pull/256))

  This makes it more ergonomic to install JavaScript dependencies and start the development server.

## 0.1.3

### Patch Changes

- fix: ensure templates have correct @anywidget/\* versions ([#257](https://github.com/manzt/anywidget/pull/257))

## 0.1.2

### Patch Changes

- fix: paths for tsconfig.json ([#253](https://github.com/manzt/anywidget/pull/253))

## 0.1.1

### Patch Changes

- fix: ensure assets are checked in for JDoc template ([#251](https://github.com/manzt/anywidget/pull/251))

## 0.1.0

### Minor Changes

- feat: add vanilla template ([#248](https://github.com/manzt/anywidget/pull/248))

- feat: add Vanilla TS template ([#248](https://github.com/manzt/anywidget/pull/248))

- feat: add JSDoc TypeScript template ([#250](https://github.com/manzt/anywidget/pull/250))

- feat: add React TS template ([#248](https://github.com/manzt/anywidget/pull/248))

### Patch Changes

- fix: safely write and rename files within an existing `.git` directory ([#248](https://github.com/manzt/anywidget/pull/248))

  Thank you @kolibril13!
