# anywidget <a href="https://github.com/manzt/anywidget"><img align="right" src="https://raw.githubusercontent.com/manzt/anywidget/main/docs/public/favicon.svg" height="38"></img></a>

[![PyPI](https://img.shields.io/pypi/v/anywidget.svg?color=green)](https://pypi.org/project/anywidget)
[![License](https://img.shields.io/pypi/l/anywidget.svg?color=green)](https://github.com/manzt/anywidget/raw/main/LICENSE)
[![codecov](https://codecov.io/gh/manzt/anywidget/branch/main/graph/badge.svg)](https://codecov.io/gh/manzt/anywidget)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/manzt/anywidget/blob/main/examples/Counter.ipynb)

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

This is a monorepo, meaning the repo holds multiple packages. It requires the use of [pnpm](https://pnpm.js.org/en/).
You can [install pnpm](https://pnpm.io/installation) with:

```bash
npm i -g pnpm
```

Then, create a Python virtual environment with a complete development install:

```bash
pip install -e ".[dev,test]"
```

or alternatively use the [`hatch`](https://github.com/pypa/hatch) CLI:

```bash
hatch shell
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

```bash
jupyter labextension develop --overwrite anywidget
```

## Sending PRs

### Code styling

There are a few guidelines we follow:

- For JavaScript, internal variables are written with
  `snake_case` while external APIs are written with `camelCase` (if applicable).
- For Python, ensure `black --check .` and `ruff .` pass. You can run
  `black .` and `ruff --fix .` to format and fix linting errors.

### Generating changelogs

For changes to be reflected in package changelogs, run `npx changeset` and
follow the prompts. 

> **Note** not every PR requires a changeset. Since changesets are focused on 
> releases and changelogs, changes to the repository that don't effect these
> won't need a changeset (e.g., documentation, tests).

## Release

The [Changesets GitHub action](https://github.com/changesets/action) will create
and update a PR that applies changesets and publishes new versions of
**anywidget** to NPM and PyPI.
