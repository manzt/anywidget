# anywidget <a href="https://github.com/manzt/anywidget"><img align="right" src="https://raw.githubusercontent.com/manzt/anywidget/main/docs/public/favicon.svg" height="38"></img></a>

[![PyPI](https://img.shields.io/pypi/v/anywidget.svg?color=green)](https://pypi.org/project/anywidget)
[![License](https://img.shields.io/pypi/l/anywidget.svg?color=green)](https://github.com/manzt/anywidget/raw/main/LICENSE)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/manzt/anywidget/blob/main/examples/Counter.ipynb)

custom jupyter widgets made easy

- create widgets **without complicated cookiecutter templates**
- **publish to PyPI** like any other Python package
- prototype **within** `.ipynb` or `.py` files
- run in **Jupyter**, **JupyterLab**, **Google Colab**, **VSCode**, and more
- develop (optionally) with [Vite](https://vitejs.dev/) for **instant HMR**

## Installation

> **Warning**: **anywidget** is new and under active development. It is not yet ready for production as APIs are subject to change.

```
pip install anywidget
```

## Usage

```python
import anywidget
import traitlets

class CounterWidget(anywidget.AnyWidget):
    # Widget front-end JavaScript code
    _esm = """
    export function render(view) {
      let getCount = () => view.model.get("count");
      let button = document.createElement("button");
      button.innerHTML = `count is ${getCount()}`;
      button.addEventListener("click", () => {
        view.model.set("count", getCount() + 1);
        view.model.save_changes();
      });
      view.model.on("change:count", () => {
        button.innerHTML = `count is ${getCount()}`;
      });
      view.el.appendChild(button);
    }
    """
    # Stateful property that can be accessed by JavaScript & Python
    count = traitlets.Int(0).tag(sync=True)
```

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
