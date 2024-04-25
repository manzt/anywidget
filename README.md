<h1>
<p align="center">
  <img src="https://raw.githubusercontent.com/manzt/anywidget/main/docs/public/favicon.svg" alt="anywidget logo. A circular icon with two connected arrows pointing clockwise, symbolizing a refresh or restart action" width="60">
  <br>anywidget
</h1>
<samp>
  <p align="center">
    <span>custom jupyter widgets made easy</span>
      <br>
      <br>
      <a href="#installation">installation</a> .
      <a href="https://anywidget.dev">docs</a> .
      <a href="https://discord.gg/W5h4vPMbDQ">community</a> .
      <a href="https://blog.jupyter.org/anywidget-jupyter-widgets-made-easy-164eb2eae102">learn</a>
  </p>
</samp>
</p>

## About

**anywidget** uses modern web standards to simplify authoring and distributing
custom Jupyter Widgets.

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

## Packages

Beyond the primary Python package, **anywidget** provides an ecosystem of
tooling to help you build and distribute custom Jupyter Widgets.

| Name                                                                                             | Description                     | Version (click for changelogs)                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`anywidget`](https://github.com/manzt/anywidget/tree/main/packages/anywidget)                   | Primary Python package          | [![version](https://img.shields.io/pypi/v/anywidget.svg)](https://github.com/manzt/anywidget/blob/main/packages/anywidget/CHANGELOG.md)              |
| [`npm:@anywidget/types`](https://github.com/manzt/anywidget/tree/main/packages/types)            | Client type declarations        | [![version](https://img.shields.io/npm/v/@anywidget/types.svg)](https://github.com/manzt/anywidget/blob/main/packages/types/CHANGELOG.md)            |
| [`npm:@anywidget/vite`](https://github.com/manzt/anywidget/tree/main/packages/vite)              | Vite plugin                     | [![version](https://img.shields.io/npm/v/@anywidget/vite.svg)](https://github.com/manzt/anywidget/blob/main/packages/vite/CHANGELOG.md)              |
| [`npm:@anywidget/react`](https://github.com/manzt/anywidget/tree/main/packages/react)            | React framework adapter         | [![version](https://img.shields.io/npm/v/@anywidget/react.svg)](https://github.com/manzt/anywidget/blob/main/packages/react/CHANGELOG.md)            |
| [`npm:@anywidget/svelte`](https://github.com/manzt/anywidget/tree/main/packages/svelte)          | Svelte framework adapter        | [![version](https://img.shields.io/npm/v/@anywidget/svelte.svg)](https://github.com/manzt/anywidget/blob/main/packages/svelte/CHANGELOG.md)          |
| [`npm:create-anywidget`](https://github.com/manzt/anywidget/tree/main/packages/create-anywidget) | CLI to bootstrap a new project  | [![version](https://img.shields.io/npm/v/create-anywidget.svg)](https://github.com/manzt/anywidget/blob/main/packages/create-anywidget/CHANGELOG.md) |
| [`jsr:@anywidget/deno`](https://github.com/manzt/anywidget/tree/main/packages/deno)              | Backend for Deno Jupyter kernel | [![version](https://jsr.io/badges/@anywidget/deno)](https://github.com/manzt/anywidget/blob/main/packages/deno/CHANGELOG.md)                         |

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
