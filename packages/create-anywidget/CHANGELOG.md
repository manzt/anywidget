# create-anywidget

## 0.8.2

### Patch Changes

- Pin `@anywidget/react` ~v0.2 ([#837](https://github.com/manzt/anywidget/pull/837))

## 0.8.1

### Patch Changes

- Import `RenderProps` instead of `RenderContext` when scaffolding vanilla TS project ([#821](https://github.com/manzt/anywidget/pull/821))

## 0.8.0

### Minor Changes

- Upgrade TypeScript to v5.8 ([#817](https://github.com/manzt/anywidget/pull/817))

## 0.7.7

### Patch Changes

- Use React 19 in React templates ([#765](https://github.com/manzt/anywidget/pull/765))

## 0.7.6

### Patch Changes

- Upgrade TypeScript to v5.7 ([#754](https://github.com/manzt/anywidget/pull/754))

## 0.7.5

### Patch Changes

- Support `uv` and update project instructions ([#711](https://github.com/manzt/anywidget/pull/711))

## 0.7.4

### Patch Changes

- Use esbuild v0.24.0 ([#694](https://github.com/manzt/anywidget/pull/694))

## 0.7.3

### Patch Changes

- Bump TypeScript to 5.6 ([#680](https://github.com/manzt/anywidget/pull/680))

## 0.7.2

### Patch Changes

- Upgrade framework bridges ([`3a5b386295d6aae7a69c5396f04b70e25c9b8f58`](https://github.com/manzt/anywidget/commit/3a5b386295d6aae7a69c5396f04b70e25c9b8f58))

- Bump types versions ([#675](https://github.com/manzt/anywidget/pull/675))

## 0.7.1

### Patch Changes

- Update templates to esbuild v0.23 ([#620](https://github.com/manzt/anywidget/pull/620))

## 0.7.0

### Minor Changes

- Upgrade templates to TypeScript v5.5 ([#611](https://github.com/manzt/anywidget/pull/611))

## 0.6.3

### Patch Changes

- Bump esbuild to 0.21.4 ([#599](https://github.com/manzt/anywidget/pull/599))

## 0.6.2

### Patch Changes

- Bump esbuild version ([#584](https://github.com/manzt/anywidget/pull/584))

## 0.6.1

### Patch Changes

- Simplify default CSS class names ([#576](https://github.com/manzt/anywidget/pull/576))

## 0.6.0

### Minor Changes

- Rename Python Counter class to Widget ([#574](https://github.com/manzt/anywidget/pull/574))

## 0.5.9

### Patch Changes

- Bump `typescript`, `react`, `react-dom` ([#567](https://github.com/manzt/anywidget/pull/567))

## 0.5.8

### Patch Changes

- Bump dependencies ([#547](https://github.com/manzt/anywidget/pull/547))

## 0.5.7

### Patch Changes

- Update typings with experimental API ([#518](https://github.com/manzt/anywidget/pull/518))

## 0.5.6

### Patch Changes

- Fix README.md to point to static folder for un-bundled ([#496](https://github.com/manzt/anywidget/pull/496))

- Ignore `.venv` for Deno config and use defaults (rather than Trevor's preferences 🙃) ([#496](https://github.com/manzt/anywidget/pull/496))

## 0.5.5

### Patch Changes

- Switch default option to Vanilla (minimal) ([#484](https://github.com/manzt/anywidget/pull/484))

- Add `autoreload` extension to demo notebook ([#486](https://github.com/manzt/anywidget/pull/486))

## 0.5.4

### Patch Changes

- Change order of "Next steps" (npm install before git commands) ([#476](https://github.com/manzt/anywidget/pull/476))

## 0.5.3

### Patch Changes

- Add development installation instructions in the generated READMEs ([`08762a52f88b567942b44710320da65d0cb8ac06`](https://github.com/manzt/anywidget/commit/08762a52f88b567942b44710320da65d0cb8ac06))

## 0.5.2

### Patch Changes

- Set `ANYWIDGET_HMR=1` in demo notebook ([#470](https://github.com/manzt/anywidget/pull/470))

## 0.5.1

### Patch Changes

- Add README.md to pyproject.toml ([#437](https://github.com/manzt/anywidget/pull/437))

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
