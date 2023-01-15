import pathlib
from typing import Dict, Union

from traitlets.traitlets import TraitType, Unicode

from ._widget import AnyWidget


def _create_synced_unicode_trait(src: Union[str, pathlib.Path]):
    # read the file contents src is a path
    try:
        path = pathlib.Path(src)
        if path.exists():
            src = path.read_text()
    except OSError:
        ...
    return Unicode(src).tag(sync=True)  # type: ignore


def anywidget(
    esm: Union[str, pathlib.Path],
    css: Union[str, pathlib.Path, None] = None,
):
    traits: Dict[str, TraitType] = {"_esm": _create_synced_unicode_trait(esm)}

    if css:
        traits["_css"] = _create_synced_unicode_trait(css)

    def wrap(cls):
        cls_dict = dict(cls.__dict__)
        cls_dict.update(traits)  # type: ignore
        return type(cls.__name__, (AnyWidget, *cls.__mro__), cls_dict)

    return wrap
