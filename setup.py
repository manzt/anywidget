import json
from pathlib import Path

from setuptools import setup
from jupyter_packaging import get_data_files, npm_builder, wrap_installers

here = Path(__file__).parent.resolve()

with open(here / "package.json") as f:
    version = json.load(f)["version"]

# representative files that should exist after build
targets = [
    str(here / "anywidget" / "nbextension" / "index.js"),
    str(here / "anywidget" / "labextension" / "package.json"),
]

builder = npm_builder(build_cmd="build", npm="npm")

cmdclass = wrap_installers(
    pre_develop=builder,
    pre_dist=builder,
    ensured_targets=targets,
    skip_if_exists=targets,
)

data_files = get_data_files([
    (
        "share/jupyter/nbextensions/anywidget/",
        "anywidget/nbextension/",
        "*"
    ),
    (
        "share/jupyter/labextensions/anywidget/",
        "anywidget/labextension/",
        "**"
    ),
    (
        "etc/jupyter/nbconfig/notebook.d/",
        ".",
        "anywidget.json",
    ),
])

if __name__ == "__main__":
    setup(version=version, cmdclass=cmdclass, data_files=data_files)
