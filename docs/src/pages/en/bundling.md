---
title: Bundling
description: Docs bundling
layout: ../../layouts/MainLayout.astro
---

**anywidget** does not require you to bundle or transform your JavaScript source
code. However, the use of local dependencies or non-standard syntax (e.g.,
TypeScript, React, Vue, Solid, Svelte) necessitates the use of a bundler to
merge together files into a single optimized ESM file.

## Disclaimer: Keeping anywidget Simple

For folks new to JavaScript, you might encounter suggestions or be tempted to
use various front-end technologies. It's important to understand trade-offs in
the context of widgets:

1. **Deviation from Browser Standards**: **anywidget** emphasizes browser-native
   JavaScript, ensuring the code you write is directly interpretable by
   browsers. Using frameworks like React, Svelte, Vue, or even tools like
   TypeScript introduces new concepts and syntax which can lead to
   misconceptions when learning what is (and what is not) the front end.

2. **Additional Tooling**: Such technologies require your front-end code to be
   transformed before browsers can understand it, a step that needs to be
   repeated any time you make changes. Without them, **anywidget** projects can
   be packaged and developed purely with Python. However, adding such
   technologies transforms your project into a hybrid of Python and JavaScript,
   requiring tools like Node.js, a package manager, and bundler.

Our recommendation? Keep it simple and use browser-native JavaScript, avoiding
JavaScript tooling and complexity. Navigating a hybrid JavaScript-Python project
has its challenges; maintaining pure JavaScript offers long-term benefits. While
front-end frameworks manage complex states, most widgets don't need this. If
yours does, consider creating a dedicated JavaScript library for the widget's
core.

For TypeScript enthusiasts, consider TypeScript through
[JSDoc comments](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).
It offers type safety without needing a build step.

## Project Templates

Bootstrap a new widget repository that is ready to publish to PyPI:

```sh
npm create anywidget@latest # or pnpm, yarn
```

Every template is a `hatchling`-based and uses the `hatchling-jupyter-builder`
plugin to bundle the widget front-end code during a
[PEP 517](https://peps.python.org/pep-0517/) build. We prefer
[esbuild](https://esbuild.github.io/) for bundling in most of the templates,
unless [Bun](https://bun.sh/) is used to create the project,

```sh
bun create anywidget@latest
```

which will prefer Bun's built-in bundler.

## Bundler Guides

We recommend using one of the above project templates if you widget needs a
bundler. However, the follow sections provide a general guide of configuring
these bundlers.

### esbuild

[esbuild](https://esbuild.github.io/) is very fast JavaScript bundler written in
Golang. It can transform **TypeScript, JSX, and CSS files** and includes zero
JavaScript dependencies. Binaries can be
[installed without `npm`](https://esbuild.github.io/getting-started/#other-ways-to-install),
making it a great fit for **anywidget** projects.

#### Project Setup

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

#### Build

We can bundle these assets into `hello_widget/static` with `esbuild`:

```bash
esbuild --bundle --format=esm --outdir=hello_widget/static src/index.js
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
  _esm = bundler_output_dir / "index.js"
  _css = bundler_output_dir / "styles.css"
  name = traitlets.Unicode().tag(sync=True)
```

#### Development

The `esbuild` CLI also includes a "watch" mode, which tells esbuild to listen
for changes on the file system and automatically rebuild whenever a file changes
that could invalidate the build. **anywidget**'s
[native HMR](/blog/anywidget-02#native-hot-module-replacement-hmr) will watch
for changes to the re-bundled outputs from `esbuild`, swapping in the new bundle
in the front end.

```bash
esbuild --bundle --format=esm --outdir=hello_widget/static src/index.js --watch
```

### Vite

Our [Vite](https://vitejs.dev/) plugin offers a more fully featured development
experience compared to **anywidget**'s builtin HMR, but at the cost of added
project complexity and tooling. Vite is a good choice if you want to use a
front-end framework like Svelte or Vue or need more fine grain control over your
bundling.

#### Project Setup

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

#### Build

We can now bundle the assets into `hello_widget/static` with Vite, just like
esbuild. Again, make sure the final bundled assets are loaded by the Python
module.

```bash
npx vite build
# vite v4.0.4 building for production...
# ✓ 2 modules transformed.
# hello_widget/static/style.css  0.05 kB │ gzip: 0.06 kB
# hello_widget/static/index.mjs  0.13 kB │ gzip: 0.14 kB
```

#### Development

The Vite plugin for **anywidget** extends its dev server with precise HMR
support for Jupyter Widgets. To get started with HMR for your widget, install
the `anywidget` Plugin and add the following to your `vite.config.js`:

```bash
npm install -D @anywidget/vite
```

```diff
// vite.config.js
import { defineConfig } from "vite";
+ import anywidget from "@anywidget/vite";

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

Any changes to `src/*` will now be updated immediately in active output cells
with this widget. Happy coding!
