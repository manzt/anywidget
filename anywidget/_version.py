import json
import pathlib

here = pathlib.Path(__file__).parent

# This file is writen by `jupyter labextension build .`
with open(here / "labextension" / "package.json") as f:
    pkg = json.load(f)

__version__ = pkg["version"]
