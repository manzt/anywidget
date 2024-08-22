# Contributing Guide

## Preparing

This is a monorepo, meaning the repo holds multiple packages. Since the project
contains both JavaScript and Python components, it requires dual package
managers:

- [pnpm](https://pnpm.io) for JavaScript
- [uv](https://github.com/astral-sh/uv) for Python

You can [install pnpm](https://pnpm.io/installation) and
[install uv](https://github.com/astral-sh/uv) with:

```bash
npm i -g pnpm
curl -LsSf https://astral.sh/uv/install.sh | sh # for Linux and macOS, see link for Windows
```

## Code structure

Entry points to be aware of:

- [`anywidget`](https://github.com/manzt/anywidget/tree/main/anywidget) -
  primary Python package
- [`packages/anywidget`](https://github.com/manzt/anywidget/tree/main/packages/anywidget) -
  JavaScript component of the Python package
- [`packages/types`](https://github.com/manzt/anywidget/tree/main/packages/types) -
  type declarations for anywidget (`@anywidget/types`)
- [`packages/vite`](https://github.com/manzt/anywidget/tree/main/packages/vite) -
  [Vite](https://vitejs.dev/) plugin (`@anywidget/vite`)
- [`packages/react`](https://github.com/manzt/anywidget/tree/main/packages/react) -
  [React](https://react.dev/) bridge (`@anywidget/react`)
- [`packages/svelte`](https://github.com/manzt/anywidget/tree/main/packages/svelte) -
  [Svelte](https://svelte.dev/) bridge (`@anywidget/svelte`)
- [`packages/create-anywidget`](https://github.com/manzt/anywidget/tree/main/packages/create-anywidget) -
  CLI to create a new anywidget project
- [`packages/deno`](https://github.com/manzt/anywidget/tree/main/packages/deno) -
  anywidget backend for [Deno](https://deno.com/) Jupyter kernel
- [`packages/signals`](https://github.com/manzt/anywidget/tree/main/packages/signals) -
  A signals bridge for anywidget

## Making changes

Once your environment is set up, you can start making changes to the codebase.
We recommend using the classic Jupyter Notebook or Jupyter Lab for development.

If you are using the classic Jupyter Notebook (<v7) you need to install the local
nbextension:

```bash
uv run jupyter nbextension install --py --symlink --sys-prefix anywidget
uv run jupyter nbextension enable --py --sys-prefix anywidget
```

Note for developers:

- the `-e` pip option allows one to modify the Python code in-place. Restart the
  kernel in order to see the changes.
- the `--symlink` argument on Linux or OS X allows one to modify the JavaScript
  code in-place. This feature is not available with Windows.

For developing with JupyterLab:

```bash
uv run jupyter labextension develop --overwrite anywidget
```

> **Note** If you make changes to the Python code, you'll need to restart the
> Jupyter kernel and re-execute the cells to see the changes. If you modify the
> JavaScript widget code (`packages/anywidget/src/*`), you will need to rebuild
> the JavaScript using `pnpm build`.

## Sending PRs

### Code styling

There are a few guidelines we follow:

- For JavaScript, internal variables are written with `snake_case` while
  external APIs are written with `camelCase` (if applicable).
- For Python, ensure typechecking and linting passes.

Commands to know:

```sh
uv run ruff check # linting
uv run ruff format # formatting
uv run mypy # typechecking
```

### Generating changelogs

For changes to be reflected in package changelogs, run `npx changeset` and
follow the prompts.

> **Note** not every PR requires a changeset. Since changesets are focused on
> releases and changelogs, changes to the repository that don't effect these
> won't need a changeset (e.g., documentation, tests).

## Release

The [Changesets GitHub action](https://github.com/changesets/action) will create
and update a PR that applies changesets and publishes new versions of
**anywidget** to NPM and PyPI.
