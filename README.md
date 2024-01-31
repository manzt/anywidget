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

Learn more in the
[Jupyter blog](https://blog.jupyter.org/anywidget-jupyter-widgets-made-easy-164eb2eae102).

## Installation

**anywidget** is available on [PyPI](https://pypi.org/project/anywidget/):

```bash
pip install "anywidget[dev]"
```

and also on [conda-forge](https://anaconda.org/conda-forge/anywidget):

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
    function render({ model, el }) {
      let button = document.createElement("button");
      button.innerHTML = `count is ${model.get("value")}`;
      button.addEventListener("click", () => {
        model.set("value", model.get("value") + 1);
        model.save_changes();
      });
      model.on("change:value", () => {
        button.innerHTML = `count is ${model.get("value")}`;
      });
      el.appendChild(button);
    }
    export default { render };
    """
    # Stateful property that can be accessed by JavaScript & Python
    value = traitlets.Int(0).tag(sync=True)
```

Front-end code can also live in separate files (recommend):

```python
import pathlib
import anywidget
import traitlets

class CounterWidget(anywidget.AnyWidget):
    _esm = pathlib.Path("index.js")
    _css = pathlib.Path("styles.css")
    value = traitlets.Int(0).tag(sync=True)
```

Read [the documentation](https://anywidget.dev/en/getting-started) to learn
more.

## Support

Having trouble? Get help in our [Discord](https://discord.gg/W5h4vPMbDQ) or open
a [Discussion](https://github.com/manzt/anywidget/issues/new).

## Contributing

**New contributors welcome!** Check out our
[Contributors Guide](./CONTRIBUTING.md) for help getting started.

Join us on [Discord](https://discord.gg/W5h4vPMbDQ) to meet other maintainers.
We'll help you get your first contribution in no time!

## License

[MIT](https://github.com/manzt/anywidget/blob/main/LICENSE)
