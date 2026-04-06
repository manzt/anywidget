# Contributing Guide

## Preparing

This is a monorepo, meaning the repo holds multiple packages. Since the project
contains both JavaScript and Python components, it requires:

- [vp](https://github.com/voidzero-dev/vite-plus) for JavaScript (linting, formatting, testing, and package management)
- [uv](https://github.com/astral-sh/uv) for Python

You can [install vp](https://github.com/voidzero-dev/vite-plus) and
[install uv](https://github.com/astral-sh/uv) with:

```bash
npx vp@latest # or see vp docs for global install
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
We recommend using Jupyter Lab for development:

```bash
uv run jupyter labextension develop --overwrite anywidget
```

> **Note** If you make changes to the Python code, you'll need to restart the
> Jupyter kernel and re-execute the cells to see the changes. If you modify the
> JavaScript widget code (`packages/anywidget/src/*`), you will need to rebuild
> the JavaScript using `vp run build`.

## Sending PRs

### Code styling

There are a few guidelines we follow:

- For JavaScript, internal variables are written with `snake_case` while
  external APIs are written with `camelCase` (if applicable).
- For Python, ensure typechecking and linting passes.

Commands to know:

```sh
# JavaScript
vp check      # linting, formatting, and typechecking
vp check --fix # auto-fix issues

# Python
uv run ruff check  # linting
uv run ruff format # formatting
uv run ty check    # typechecking
```

### Generating changelogs

For changes to be reflected in package changelogs, run `vp dlx changeset` and
follow the prompts.

> **Note** not every PR requires a changeset. Since changesets are focused on
> releases and changelogs, changes to the repository that don't effect these
> won't need a changeset (e.g., documentation, tests).

## Release

The [Changesets GitHub action](https://github.com/changesets/action) will create
and update a PR that applies changesets and publishes new versions of
**anywidget** to NPM and PyPI.
