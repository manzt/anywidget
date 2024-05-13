# Contributing Guide

## Preparing

This is a monorepo, meaning the repo holds multiple packages. Since the project
contains both JavaScript and Python components, it requires dual package
managers:

- [pnpm](https://pnpm.js.org/en/) for JavaScript
- [hatch](https://github.com/pypa/hatch) for Python

You can [install pnpm](https://pnpm.io/installation) and
[install hatch](https://github.com/pypa/hatch) with:

```bash
npm i -g pnpm
pipx install hatch
```

Then, create a Python virtual environment with `hatch`:

```bash
hatch shell
```

This command creates a virtual environment and installs all dependencies
specified in the `pyproject.toml`. It also installs **anywidget** in development
mode. The environment setup might take some time during the first run, but
`hatch` reuses the environment in subsequent runs.

You can deactivate the environment with `Ctrl + D` and reset it using
`hatch env remove`. For more information, read the
[hatch docs](https://hatch.pypa.io/latest/).

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
  [React](https://react.dev/) adapter (`@anywidget/react`)
- [`packages/svelte`](https://github.com/manzt/anywidget/tree/main/packages/svelte) -
  [Svelte](https://svelte.dev/) adapter (`@anywidget/svelte`)
- [`packages/create-anywidget`](https://github.com/manzt/anywidget/tree/main/packages/create-anywidget) -
  CLI to create a new anywidget project
- [`packages/deno`](https://github.com/manzt/anywidget/tree/main/packages/deno) -
  anywidget backend for [Deno](https://deno.com/) Jupyter kernel

## Making changes

Once your environment is set up, you can start making changes to the codebase.
We recommend using the classic Jupyter Notebook or Jupyter Lab for development.

If you are using the classic Jupyter Notebook you need to install the local
nbextension:

```bash
jupyter nbextension install --py --symlink --sys-prefix anywidget
jupyter nbextension enable --py --sys-prefix anywidget
```

Note for developers:

- the `-e` pip option allows one to modify the Python code in-place. Restart the
  kernel in order to see the changes.
- the `--symlink` argument on Linux or OS X allows one to modify the JavaScript
  code in-place. This feature is not available with Windows.

For developing with JupyterLab:

```bash
jupyter labextension develop --overwrite anywidget
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
- For Python, ensure `hatch run lint` passes. You can run `hatch run fmt` to
  format and fix linting errors.

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
