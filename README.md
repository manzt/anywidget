<h1>
<p align="center">
  <img src="https://raw.githubusercontent.com/manzt/anywidget/main/docs/public/favicon.svg" alt="anywidget logo. A circular icon with two connected arrows pointing clockwise, symbolizing a refresh or restart action" width="60">
  <br>anywidget
</h1>
<samp>
  <p align="center">
    <span>reusable widgets made easy</span>
      <br>
      <br>
      <a href="#installation">installation</a> .
      <a href="https://anywidget.dev">docs</a> .
      <a href="https://discord.gg/W5h4vPMbDQ">discord</a> .
      <a href="https://blog.jupyter.org/anywidget-jupyter-widgets-made-easy-164eb2eae102">learn</a>
  </p>
</samp>
</p>

## About

**anywidget** is both a [**specification**](https://anywidget.dev/en/afm) and
**toolkit** for authoring reusable web-based widgets for interactive computing
environments.

- 🛠️ create custom Jupyter Widgets **without complicated cookiecutter templates**
- 📚 **publish to PyPI** like any other Python package
- 🤖 prototype **within** `.ipynb` or `.py` files
- 🚀 run in **Jupyter**, **JupyterLab**, **Google Colab**, **VSCode**, [**marimo**](https://github.com/marimo-team/marimo) and more
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

The easiest way to start developing with **anywidget** is with the Python package.

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
tooling to help you build and distribute custom widgets.

| Name                                                                                             | Description                     | Version (click for changelogs)                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`anywidget`](https://github.com/manzt/anywidget/tree/main/packages/anywidget)                   | Primary Python package          | [![version](https://img.shields.io/pypi/v/anywidget.svg?labelColor=0273B7&color=0C3141)](https://github.com/manzt/anywidget/blob/main/packages/anywidget/CHANGELOG.md)                             |
| [`npm:@anywidget/types`](https://github.com/manzt/anywidget/tree/main/packages/types)            | Client type declarations        | [![version](https://img.shields.io/npm/v/@anywidget/types.svg?labelColor=C43636&color=0C3141&logo=npm&label)](https://github.com/manzt/anywidget/blob/main/packages/types/CHANGELOG.md)            |
| [`npm:@anywidget/vite`](https://github.com/manzt/anywidget/tree/main/packages/vite)              | Vite plugin                     | [![version](https://img.shields.io/npm/v/@anywidget/vite.svg?labelColor=C43636&color=0C3141&logo=npm&label)](https://github.com/manzt/anywidget/blob/main/packages/vite/CHANGELOG.md)              |
| [`npm:@anywidget/react`](https://github.com/manzt/anywidget/tree/main/packages/react)            | React framework bridge          | [![version](https://img.shields.io/npm/v/@anywidget/react.svg?labelColor=C43636&color=0C3141&logo=npm&label)](https://github.com/manzt/anywidget/blob/main/packages/react/CHANGELOG.md)            |
| [`npm:@anywidget/svelte`](https://github.com/manzt/anywidget/tree/main/packages/svelte)          | Svelte framework bridge         | [![version](https://img.shields.io/npm/v/@anywidget/svelte.svg?labelColor=C43636&color=0C3141&logo=npm&label)](https://github.com/manzt/anywidget/blob/main/packages/svelte/CHANGELOG.md)          |
| [`npm:create-anywidget`](https://github.com/manzt/anywidget/tree/main/packages/create-anywidget) | CLI to bootstrap a new project  | [![version](https://img.shields.io/npm/v/create-anywidget.svg?labelColor=C43636&color=0C3141&logo=npm&label)](https://github.com/manzt/anywidget/blob/main/packages/create-anywidget/CHANGELOG.md) |
| [`jsr:@anywidget/deno`](https://github.com/manzt/anywidget/tree/main/packages/deno)              | Backend for Deno Jupyter kernel | [![version](https://jsr.io/badges/@anywidget/deno)](https://github.com/manzt/anywidget/blob/main/packages/deno/CHANGELOG.md)                                                                       |
| [`jsr:@anywidget/signals`](https://github.com/manzt/anywidget/tree/main/packages/signals)        | Signals bridge                  | [![version](https://jsr.io/badges/@anywidget/signals)](https://github.com/manzt/anywidget/blob/main/packages/signals/CHANGELOG.md)                                                                 |

## Support

Having trouble? Get help in our [Discord](https://discord.gg/W5h4vPMbDQ) or open
a [Discussion](https://github.com/manzt/anywidget/issues/new).

## Contributing

**New contributors welcome!** Check out our
[Contributors Guide](./CONTRIBUTING.md) for help getting started.

Join us on [Discord](https://discord.gg/W5h4vPMbDQ) to meet other maintainers.
We'll help you get your first contribution in no time!

## Citation

If you use **anywidget** in your work, please consider citing the following
publications:

Our [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.06939) describing
the overall project and vision:

```bibtex
@article{manz2024anywidget,
  title = {anywidget: reusable widgets for interactive analysis and visualization in computational notebooks},
  volume = {9},
  url = {https://doi.org/10.21105/joss.06939},
  doi = {10.21105/joss.06939},
  number = {102},
  journal = {Journal of Open Source Software},
  author = {Manz, Trevor and Abdennur, Nezar and Gehlenborg, Nils},
  year = {2024},
  note = {Publisher: The Open Journal},
  pages = {6939},
}
```

Our [SciPy paper](https://proceedings.scipy.org/articles/NRPV2311), detailing
the motivation and approach behind Jupyter Widget ecosystem compatability:

```bibtex
@inproceedings{manz2024notebooks,
  title = {Any notebook served: authoring and sharing reusable interactive widgets},
  copyright = {https://creativecommons.org/licenses/by/4.0/},
  url = {https://doi.org/10.25080/NRPV2311},
  doi = {10.25080/NRPV2311},
  urldate = {2024-10-07},
  booktitle = {Proceedings of the 23rd {Python} in {Science} {Conference}},
  author = {Manz, Trevor and Gehlenborg, Nils and Abdennur, Nezar},
  month = jul,
  year = {2024},
}
```
