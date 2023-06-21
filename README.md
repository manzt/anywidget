# anywidget <a href="https://github.com/manzt/anywidget"><img align="right" src="https://raw.githubusercontent.com/manzt/anywidget/main/docs/public/favicon.svg" height="38"></img></a>

[![PyPI](https://img.shields.io/pypi/v/anywidget.svg?color=green)](https://pypi.org/project/anywidget)
[![License](https://img.shields.io/pypi/l/anywidget.svg?color=green)](https://github.com/manzt/anywidget/raw/main/LICENSE)
[![codecov](https://codecov.io/gh/manzt/anywidget/branch/main/graph/badge.svg)](https://codecov.io/gh/manzt/anywidget)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/manzt/anywidget/blob/main/examples/Counter.ipynb)
[![DOI](https://zenodo.org/badge/557583774.svg)](https://zenodo.org/badge/latestdoi/557583774)

custom jupyter widgets made easy

- 🛠️ create widgets **without complicated cookiecutter templates**
- 📚 **publish to PyPI** like any other Python package
- 🤖 prototype **within** `.ipynb` or `.py` files
- 🚀 run in **Jupyter**, **JupyterLab**, **Google Colab**, **VSCode**, and more
- ⚡ develop with **instant HMR**, like modern web frameworks

Learn more in
[the announcement](https://anywidget.dev/blog/introducing-anywidget).

## Installation

> **Warning**: **anywidget** is new and under active development. It is not yet
> ready for production as APIs are subject to change.

**anywidget** is available on [PyPI](https://pypi.org/project/anywidget/) and
may be installed with `pip`:

```bash
pip install "anywidget[dev]"
```

It is also available on
[conda-forge](https://anaconda.org/conda-forge/anywidget). If you have
[Anaconda](https://www.anaconda.com/distribution/#download-section) or
[Miniconda](https://docs.conda.io/en/latest/miniconda.html) installed on your
computer, you can install **anywidget** with the following command:

```bash
conda install -c conda-forge anywidget
```

## Usage

```python
import anywidget
import traitlets

class CounterWidget(anywidget.AnyWidget):
    # Widget front-end JavaScript code
    _esm = """
    export function render({ model, el }) {
      let getCount = () => model.get("count");
      let button = document.createElement("button");
      button.innerHTML = `count is ${getCount()}`;
      button.addEventListener("click", () => {
        model.set("count", getCount() + 1);
        model.save_changes();
      });
      model.on("change:count", () => {
        button.innerHTML = `count is ${getCount()}`;
      });
      el.appendChild(button);
    }
    """
    # Stateful property that can be accessed by JavaScript & Python
    count = traitlets.Int(0).tag(sync=True)
```

Front-end code can also live in separate files (recommend):

```python
import pathlib
import anywidget
import traitlets

class CounterWidget(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
    _css = pathlib.Path("styles.css")

    count = traitlets.Int(0).tag(sync=True)
```

Read [the documentation](https://anywidget.dev/en/getting-started) to learn
more.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for information on how to develop **anywidget** locally.

## License

[MIT](https://github.com/manzt/anywidget/blob/main/LICENSE)
