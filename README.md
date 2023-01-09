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

### installation

```
pip install anywidget
```

### usage

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

### why

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

### how

Widgets are defined by combining an
[ECMAScript Module](https://nodejs.org/api/esm.html) with a Python class which
derives from `anywidget.AnyWidget`. The provided ECMAScript Module _must_
include a named export called `render` to render the corresponding view. You can
add and sync new properties by adding `traitlets` in your derived Python classes
and subscribing and publishing changes via `view.model` in the client `render`
function.

> **Note** Your JS code _must_ be vaid ESM. You can import dependencies from a
> CDN (e.g., `import * as d3 from "https://esm.sh/d3"`) or use a bundler targeting
> ESM.

### advanced: bundling + vite integration

Often the ESM required to connect a JavaScript library to Python with **anywidget**
is minimal and can easily be inlined _within_ the Python module as a string.
This feature allows Python developers to be productive with **anywidget**
immediately without requiring intimite knowledge frontend tooling (e.g.,
`npm`/`yarn`/`pnpm`, Webpack/Vite).

As **anywidget** projects mature, however, it is recommended to organize the JavaScript
source into separate files which can be merged together into a single optimized file.
This merging process is called _bundling_ and is required with popular fontend
frameworks (e.g., React, Vue, Solid, Svelte) that include unsupported ESM syntax.

```python
# counter_widget/counter.py
import pathlib
import anywidget
import traitlets

bundled_assets_dir = pathlib.Path(__file__).parent / "static"

class CounterWidget(anywidget.AnyWidget):
  _esm = (bundled_assets_dir / "index.js").read()
  _css = (bundled_assets_dir / "styles.css").read()
  count = traitlets.Int(0).tag(sync=True)
```

We recommend using [Vite](https://vitejs.dev/) while developing your widget at
this stage. It is simple to configure, and our custom plugin allows for
best-in-class developer experience with live-reloading.

```bash
npm install -D vite anywidget
```

```javascript
// vite.config.js
import { defineConfig } from "vite";
import anywidget from "anywidget/vite";

export default defineConfig({
  build: {
    entry: "src/index.js",
    formats: ["es"],
    outDir: ["counter_widget/static"],
  },
  plugins: [anywidget()]
});
```

```python
# counter_widget/counter.py
import pathlib
import anywidget
import traitlets

_DEV = True

if _DEV:
  ESM = "https://localhost:5173/src/index.js"
  CSS = ""
else:
  bundled_assets_dir = pathlib.Path(__file__).parent / "static"
  ESM = (bundled_assets_dir / "index.js").read()
  CSS = (bundled_assets_dir / "styles.css").read()

class CounterWidget(anywidget.AnyWidget):
  _esm = ESM
  _css = CSS
  count = traitlets.Int(0).tag(sync=True)
```

### development

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

### release

```
npm version [major|minor|patch]
git tag -a vX.X.X -m "vX.X.X"
git push --follow-tags
```
