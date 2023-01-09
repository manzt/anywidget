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

ESM = """
export function render(view) {
  let root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridAutoFlow = "column";
  root.style.textAlign = "center";

  let decrement = Object.assign(document.createElement("button"), {
    innerText: "-",
    onclick: () => {
      view.model.set("count", view.model.get("count") - 1);
      view.model.save_changes();
    }
  });

  let p = Object.assign(document.createElement("p"), {
    innerText: view.model.get("count") ?? 0,
  });

  let increment = Object.assign(document.createElement("button"), {
    innerText: "+",
    onclick: () => {
      view.model.set("count", view.model.get("count") + 1);
      view.model.save_changes();
    }
  });

  view.model.on("change:count", () => {
    p.innerText = view.model.get("count");
  });

  root.appendChild(decrement);
  root.appendChild(p);
  root.appendChild(increment);
  view.el.appendChild(root);
}
"""

# Alternatively, a URL
# ESM = "http://localhost:5173/index.js"

class CounterWidget(anywidget.AnyWidget):
    _esm = traitlets.Unicode(ESM).tag(sync=True) # required, must be ESM
    count = traitlets.Int(0).tag(sync=True)
```

<img alt="Counter with increment and decrement buttons" src="https://user-images.githubusercontent.com/24403730/197911403-88843b90-d905-4877-8cb5-f55b193f2158.png">

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
Python module. No need to create a new cookiecutter repo or maintain complicated
build scripts.

### how

Widgets are defined by combining an
[ECMAScript Module](https://nodejs.org/api/esm.html) with a Python class which
derives from `anywidget.AnyWidget`. The provided ECMAScript Module _must_
include a named export called `render` to render the corresponding view. You can
add and sync new properties by adding `traitlets` in your derived Python classes
and subscribing and publishing changes via `view.model` in the client `render`
function.

> **Note** Your JS code _must_ be vaid ESM. You can import dependencies from a
> CDN (e.g., `import * as d3 from "https://esm.sh/d3"`) or use a bundler which
> targets ESM.

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
