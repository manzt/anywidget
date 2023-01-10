# anywidget

[![PyPI](https://img.shields.io/pypi/v/anywidget.svg?color=green)](https://pypi.org/project/anywidget)
[![License](https://img.shields.io/pypi/l/anywidget.svg?color=green)](https://github.com/manzt/anywidget/raw/main/LICENSE)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/manzt/anywidget/blob/main/examples/Counter.ipynb)

simple, custom jupyter widgets that "just work"

- create widgets **without complicated cookiecutter templates**
- **publish to PyPI** like any other Python package
- prototype **within** `.ipynb` or `.py` files
- run in **Jupyter**, **JupyterLab**, **Google Colab**, **VSCode**, and more
- develop (optionally) with [Vite](https://vitejs.dev/) for **instant HMR**

## Installation

```
pip install anywidget
```

## Usage

```python
import anywidget
import traitlets

CSS = """
.counter-btn {
  background-image: linear-gradient(to right, #a1c4fd, #c2e9fb);
  border: 0;
  border-radius: 10px;
  padding: 10px 50px;
}
"""

ESM = """
export function render(view) {
  let counter = Object.assign(document.createElement("button"), {
    className: "counter-btn",
    innerHTML: `count is ${view.model.get("count")}`,
    onclick: () => {
      view.model.set("count", view.model.get("count") + 1);
      view.model.save_changes();
    },
  });
  view.model.on("change:count", () => {
    counter.innerHTML = `count is ${view.model.get("count")}`;
  });
  view.el.appendChild(counter);
}
"""

class CounterWidget(anywidget.AnyWidget):
    _esm = ESM # required, must export `render`
    _css = CSS # optional
    count = traitlets.Int(0).tag(sync=True)

CounterWidget()
```

<img alt="button indicating the number of times it has been clicked" src="https://user-images.githubusercontent.com/24403730/211375729-4e382bb0-8459-42ab-82f7-06d91d8b14d2.png">

## Why

**anywidget** simplifies the creation of custom Jupyter widgets – no complicated
build steps or bundling required.

Official
[cookiecutter templates](https://github.com/jupyter-widgets/?q=cookiecutter&type=all&language=&sort=)
provide the defacto approach for creating custom Jupyter widgets, but derived
projects are bootstrapped with complicated packaging and distribution scripts
which must be maintained by the widget author. While the cookiecutters initially
ensure compatability with various notebook or notebook-like environments,
substantial developer effort is required to keep the vendored tooling from
breaking over time.

**anywidget** reduces this burden and improves the Jupyter widget developer
experience. It ensures your widget's compatability with the fractured Jupyter
ecosystem rather than requiring each author to solve this same multi-platform
packaging problem. Creating custom widgets with **anywidget** is fun and easy.
You can start prototyping _within_ a notebook and publish on PyPI like any other
Python module. No need to create a new cookiecutter repo, maintain complicated
build scripts, or understand JavaScript dependency/build tooling to get started.

## How

Widgets are defined by combining an
[ECMAScript Module](https://nodejs.org/api/esm.html) with a Python class which
derives from `anywidget.AnyWidget`. The provided ECMAScript Module _must_
include a named export called `render` to render the corresponding view. You can
add and sync new properties by adding `traitlets` in your derived Python classes
and subscribing and publishing changes via `view.model` in the client `render`
function.

> **Note** Your JS code _must_ be vaid ESM. You can import dependencies from a
> CDN (e.g., `import * as d3 from "https://esm.sh/d3"`) or use a bundler
> targeting ESM.

## Advanced

### Bundling

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

#### Example (esbuild)

##### Setup

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

##### Build

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
  _esm = (bundler_output_dir / "index.js").read()
  _css = (bundler_output_dir / "styles.css").read()
  name = traitlets.Unicode().tag(sync=True)
```

> **Note** `esbuild` is the most simple option for bundling, but it must be
> executed manually each time changes are made to the JS or CSS source files in
> order to see changes in Python. See the Vite example for a better developer
> experience.

#### Example (Vite, recommended)

We recommend using [Vite](https://vitejs.dev/) while developing your widget at
this stage. It is simple to configure, and our custom _plugin_ allows for
best-in-class developer experience.

##### Setup

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

##### Build

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

##### Dev

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
  ESM = (bundled_assets_dir / "index.mjs").read()
  CSS = (bundled_assets_dir / "styles.css").read()

class HelloWidget(anywidget.AnyWidget):
  _esm = ESM
  _css = CSS
  name = traitlets.Unicode().tag(sync=True)
```

Any changes to `src/*` will now be updated immediate in active output cells with
for this widget. Happy coding!

## Development

```bash
pip install -e .
```

If you are using the classic Jupyter Notebook you need to install the
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

```
jupyter labextension develop --overwrite anywidget
```

## Release

```
npm version [major|minor|patch]
git tag -a vX.X.X -m "vX.X.X"
git push --follow-tags
```
