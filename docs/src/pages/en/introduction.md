---
title: Introduction
description: Docs intro
layout: ../../layouts/MainLayout.astro
---

**simple, custom jupyter widgets that "just work"**

- create widgets without complicated cookiecutter templates
- publish to PyPI like any other Python package
- prototype within .ipynb or .py files
- run in Jupyter, JupyterLab, Google Colab, VSCode, and more
- develop (optionally) with Vite for instant HMR

```python
import anywidget
import traitlets

ESM = """
export function render(view) {
  let counter = document.createElement("button");
  counter.className = "counter-btn";
  counter.innerHTML = `count is ${view.model.get("count")}`;
  counter.addEventListener("click" () => {
    view.model.set("count", view.model.get("count") + 1);
    view.model.save_changes();
  });
  view.model.on("change:count", () => {
    counter.innerHTML = `count is ${view.model.get("count")}`;
  });
  view.el.appendChild(counter);
}
"""

class CounterWidget(anywidget.AnyWidget):
    _esm = ESM
    count = traitlets.Int(0).tag(sync=True)

CounterWidget()
```

<button id="button"></button>

<script>
  let count = 0;
  let btn = document.querySelector("#button");
  let setCount = (value) => {
    count = value;
    btn.innerHTML = `count is ${count}`;
  };
  btn.addEventListener("click", () => setCount(count + 1));
  setCount(0);
</script>

## Getting Started

```javascript
export function render(view) {
  let counter = document.createElement("button");
  counter.className = "counter-btn";
  counter.innerHTML = `count is ${view.model.get("count")}`;
  counter.addEventListener("click" () => {
    view.model.set("count", view.model.get("count") + 1);
    view.model.save_changes();
  });
  view.model.on("change:count", () => {
    counter.innerHTML = `count is ${view.model.get("count")}`;
  });
  view.el.appendChild(counter);
}
```

```python
import pathlib

import anywidget
import traitlets

class CounterWidget(anywidget.AnyWidget):
    _esm = (pathlib.Path(__file__).parent / "index.js").read()
    count = traitlets.Int(0).tag(sync=True)

CounterWidget()
```

To get started with this theme, check out the `README.md` in your new project directory. It provides documentation on how to use and customize this template for your own project. Keep the README around so that you can always refer back to it as you build.

Found a missing feature that you can't live without? Please suggest it on Discord [(#ideas-and-suggestions channel)](https://astro.build/chat) and even consider adding it yourself on GitHub! Astro is an open source project and contributions from developers like you are how we grow!

Good luck out there, Astronaut. 🧑‍🚀
