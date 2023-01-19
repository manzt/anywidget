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

```
pip install anywidget
```

## Usage

```python
import anywidget
import traitlets

ESM = """
export function render(view) {
  let count = () => view.model.get("value");
  let btn = document.createElement("button");
  btn.innerHTML = `count is ${count()}`;
  btn.addEventListener("click", () => {
    view.model.set("value", count() + 1);
    view.model.save_changes();
  });
  view.model.on("change:value", () => {
    btn.innerHTML = `count is ${count()}`;
  });
  view.el.appendChild(btn);
}
"""

class CounterWidget(anywidget.AnyWidget):
    _esm = ESM
    value = traitlets.Int(0).tag(sync=True)

CounterWidget()
```

<img alt="button indicating the number of times it has been clicked" src="https://user-images.githubusercontent.com/24403730/211375729-4e382bb0-8459-42ab-82f7-06d91d8b14d2.png">

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
