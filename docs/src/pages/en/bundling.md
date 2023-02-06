---
title: Bundling
description: Docs bundling
layout: ../../layouts/MainLayout.astro
---

Often the ESM required to connect a JavaScript library to Python with
**anywidget** is minimal and can easily be inlined _within_ the Python module as
a string. This feature allows Python developers to be productive with
**anywidget** without requiring intimite knowledge or the overhead of frontend
tooling (e.g., `npm`/`yarn`/`pnpm`, Webpack/Vite/esbuild).

As **anywidget** projects mature, however, it is recommended to organize the
JavaScript source into separate files which can be merged together into a single
optimized ESM file. This merging process is called _bundling_ and is required by
popular fontend frameworks (e.g., React, Vue, Solid, Svelte) which use
unsupported browser syntax.

If using a bundler, make sure to load the final bundled assets in your widget
and not the original/untransformed JavaScript source files.

## Example (esbuild)

### Setup

The following project structure contains a python package (`hello_widget`) with
separate JS/CSS source code under `src/`:

```bash
hello_widget/
├── pyproject.toml
├── hello_widget/
│  └── __init__.py
└── src/
   ├── index.js
   └── styles.css
```

### Build

We can bundle these assets into `hello_widget/static` with
[esbuild](https://esbuild.github.io/getting-started/) without any configuration
(or install):

```bash
npx esbuild --bundle --format=esm --outdir=hello_widget/static src/index.js
#
#  hello_widget/static/index.js   150b
#  hello_widget/static/index.css   81b
#
# ⚡ Done in 2ms
```

Make sure the final bundled assets are loaded by the Python module:

```python
# hello_widget/__init__.py
import pathlib
import anywidget
import traitlets

# bundler yields hello_widget/static/{index.js,styles.css}
bundler_output_dir = pathlib.Path(__file__).parent / "static"

class HelloWidget(anywidget.AnyWidget):
  _esm = (bundler_output_dir / "index.js").read_text()
  _css = (bundler_output_dir / "styles.css").read_text()
  name = traitlets.Unicode().tag(sync=True)
```

> **Note** `esbuild` is the most simple option for bundling, but it must be
> executed manually each time changes are made to the JS or CSS source files in
> order to see changes in Python. See the Vite example for a better developer
> experience.

## Example (Vite, recommended)

We recommend using [Vite](https://vitejs.dev/) while developing your widget at
this stage. It is simple to configure, and our custom _plugin_ allows for
best-in-class developer experience.

### Setup

From the root of the project structure above.

```bash
npm install -D vite
```

Create a `vite.config.js` file with the following configuration:

```javascript
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		outDir: "hello_widget/static",
		lib: {
			entry: ["src/index.js"],
			formats: ["es"],
		},
	},
});
```

Your project structure should now look like:

```bash
hello_widget/
├── pyproject.toml
├── hello_widget/
│  └── __init__.py
├── node_modules/
├── package-lock.json
├── package.json
├── src/
│  ├── index.js
│  └── styles.css
└── vite.config.js
```

### Build

We can now bundle the assets into `hellow_widget/static` with Vite, just like
esbuild. Again, make sure the final bundled assets are loaded by the Python
module.

```bash
npx vite build
# vite v4.0.4 building for production...
# ✓ 2 modules transformed.
# hello_widget/static/style.css  0.05 kB │ gzip: 0.06 kB
# hello_widget/static/index.mjs  0.13 kB │ gzip: 0.14 kB
```

So far, this example demonstrates Vite's bundling capabilities which are similar
to esbuild. However, Vite really shines during _development_ with its second
major feature: a modern development server that enables extremely fast
[Hot Module Replacement (HMR)](https://vitejs.dev/guide/features.html#hot-module-replacement).

### Development

Frontend development tools have evolved rapidly in the last few years to enable
instant, precise updates to client code without reloading the page or blowing
away application state. Unfortunately, the cookiecutter templates for custom
Jupyter Widgets have not caught up with the times and still require full page
loads and re-bundles to see new changes.

_This all changes with **anywidget**_

The Vite plugin for **anywidget** extends its dev server with precise HMR
support for Jupyter Widgets. During development, changes made to your widget
view are **instantly** reflected in all active output cells without a full page
refresh. Model state is additionally preserved so you do not need to re-run the
Python cell to setup state.

To get started with HMR for your widget, install the `anywidget` Plugin and add
the following to your `vite.config.js`:

```bash
npm install -D anywidget
```

```diff
// vite.config.js
import { defineConfig } from "vite";
+ import anywidget from "anywidget/vite";

export default defineConfig({
  build: {
    outDir: "hello_widget/static",
    lib: {
      entry: ["src/index.js"],
      formats: ["es"],
    },
  },
+  plugin: [anywidget()],
});
```

Start the development server from the root of your project:

```bash
npx vite
#
#  VITE v4.0.4  ready in 321 ms
#
#  ➜  Local:   http://localhost:5173/
#  ➜  Network: use --host to expose
#  ➜  press h to show help
#
```

Finally, link your Python widget to the dev server during development.

```python
# hello_widget/__init__.py
import pathlib
import anywidget
import traitlets

_DEV = True # switch to False for production

if _DEV:
  # from `npx vite`
  ESM = "http://localhost:5173/src/index.js?anywidget"
  CSS = ""
else:
  # from `npx vite build`
  bundled_assets_dir = pathlib.Path(__file__).parent / "static"
  ESM = (bundled_assets_dir / "index.mjs").read_text()
  CSS = (bundled_assets_dir / "styles.css").read_text()

class HelloWidget(anywidget.AnyWidget):
  _esm = ESM
  _css = CSS
  name = traitlets.Unicode().tag(sync=True)
```

Any changes to `src/*` will now be updated immediate in active output cells with
for this widget. Happy coding!
