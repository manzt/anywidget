from __future__ import annotations

import os
import pathlib
import re
import sys
from functools import lru_cache
from typing import Any

from ._file_contents import _VIRTUAL_FILES, FileContents, VirtualFileContents

_BINARY_TYPES = (memoryview, bytearray, bytes)
_WIDGET_MIME_TYPE = "application/vnd.jupyter.widget-view+json"
_PROTOCOL_VERSION_MAJOR = 2
_PROTOCOL_VERSION_MINOR = 1
_PROTOCOL_VERSION = f"{_PROTOCOL_VERSION_MAJOR}.{_PROTOCOL_VERSION_MINOR}.0"
_ANYWIDGET_ID_KEY = "_anywidget_id"
_ESM_KEY = "_esm"
_CSS_KEY = "_css"
_DEFAULT_ESM = """
function render(view) {
  console.log("Dev note: No _esm defined for this widget:", view);
  let url = "https://anywidget.dev/en/getting-started/";
  view.el.innerHTML = `<p>
    <strong>Dev note</strong>:
    <a href='${url}' target='blank'>Implement an <code>_esm</code> attribute</a>
    on AnyWidget subclass <code>${view.model.get('_anywidget_id')}</code>
    to customize this widget.
  </p>`;
}
export default { render };
"""

# next 3 functions vendored with modifications from ipywidgets
# BSD-3-Clause
# Copyright (c) 2015 Project Jupyter Contributors
# https://github.com/jupyter-widgets/ipywidgets/blob/7325e5952efb71bd69692b2d7ed815646c0ac521/python/ipywidgets/ipywidgets/widgets/widget.py


def _separate_buffers(  # noqa: C901, PLR0912
    substate: object,
    path: list,
    buffer_paths: list,
    buffers: list,
) -> object:
    """For internal, see _remove_buffers.

    remove binary types from dicts and lists, but keep track of their paths any part of
    the dict/list that needs modification will be cloned, so the original stays
    untouched e.g. {'x': {'ar': ar}, 'y': [ar2, ar3]}, where ar/ar2/ar3 are binary types
    will result in {'x': {}, 'y': [None, None]}, [ar, ar2, ar3], [['x', 'ar'], ['y', 0],
    ['y', 1]] instead of removing elements from the list, this will make replacing the
    buffers on the js side much easier

    Raises
    ------
    TypeError
        If substate is not a list or dict.
    """
    _t = type(substate)
    _sub: list | dict | None = None
    if isinstance(substate, (list, tuple)):
        for i, v in enumerate(substate):
            if isinstance(v, _BINARY_TYPES):
                if _sub is None:
                    _sub = list(substate)  # shallow clone list/tuple
                _sub[i] = None
                buffers.append(v)
                buffer_paths.append([*path, i])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(v, [*path, i], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    if _sub is None:
                        _sub = list(substate)  # shallow clone list/tuple
                    _sub[i] = _v
    elif isinstance(substate, dict):
        for k, v in substate.items():
            if isinstance(v, _BINARY_TYPES):
                if _sub is None:
                    _sub = dict(substate)  # shallow clone dict
                del _sub[k]
                buffers.append(v)
                buffer_paths.append([*path, k])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(v, [*path, k], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    if _sub is None:
                        _sub = dict(substate)  # shallow clone dict
                    _sub[k] = _v
    else:  # pragma: no cover
        msg = f"expected state to be a list or dict, not {substate!r}"
        raise TypeError(msg)
    return _sub if _sub is not None else substate


def remove_buffers(state: object) -> tuple[Any, list[list], list[memoryview]]:
    """Return (state_without_buffers, buffer_paths, buffers) for binary message parts.

    A binary message part is a memoryview, bytearray, or python 3 bytes object.

    Examples
    --------
    >>> ar1 = np.arange(8).reshape(4, 2)
    >>> ar2 = np.arange(100).reshape(10, 10)
    >>> state = {
            'plain': [0, 'text'],
            'x': {'ar': memoryview(ar1)},
            'y': {'shape': (10,10), 'data': memoryview(ar2)}
        }
    >>> _remove_buffers(state)
    (
        {
            'plain': [0, 'text'],
            'x': {},
            'y': {'shape': (10, 10)}
        },
        [['x', 'ar'], ['y', 'data']],
        [<memory at 0x114e7fac0>, <memory at 0x114e7fed0>]
    )
    """
    buffer_paths: list = []
    buffers: list[memoryview] = []
    state = _separate_buffers(state, [], buffer_paths, buffers)
    return state, buffer_paths, buffers


def put_buffers(
    state: dict,
    buffer_paths: list[list[str | int]],
    buffers: list[memoryview],
) -> None:
    """The inverse of _remove_buffers.

    ...except here we modify the existing dict/lists.
    Modifying should be fine, since this is used when state comes from the wire.
    """
    for buffer_path, buffer in zip(buffer_paths, buffers):
        # we'd like to set say sync_data['x'][0]['y'] = buffer
        # where buffer_path in this example would be ['x', 0, 'y']
        obj = state
        for key in buffer_path[:-1]:
            obj = obj[key]
        obj[buffer_path[-1]] = buffer


def in_colab() -> bool:
    """Determines whether in Google Colab."""
    return "google.colab.output" in sys.modules


@lru_cache(maxsize=None)
def enable_custom_widget_manager_once() -> None:
    """Enables Google Colab's custom widget manager so third-party widgets display.

    See https://github.com/googlecolab/colabtools/issues/498#issuecomment-998308485
    """
    sys.modules["google.colab.output"].enable_custom_widget_manager()


def get_repr_metadata() -> dict:
    """Creates metadata dict for _repr_mimebundle_.

    If in Google Colab, enables custom widgets as a side effect
    and injects the `custom_widget_manager` metadata for more
    consistent rendering.

    See https://github.com/manzt/anywidget/issues/63#issuecomment-1427194000.
    """
    if not in_colab():
        return {}

    enable_custom_widget_manager_once()
    url = sys.modules["google.colab.output"]._widgets._installed_url  # noqa: SLF001

    if url is None:
        return {}

    return {_WIDGET_MIME_TYPE: {"colab": {"custom_widget_manager": {"url": url}}}}


def _is_hmr_enabled() -> bool:
    return os.getenv("ANYWIDGET_HMR") == "1"


def _should_start_thread(path: pathlib.Path) -> bool:
    if "site-packages" in path.parts:
        # File is inside site-packages, likely not a local development install
        return False

    if "dist-packages" in path.parts:
        # Debian-specific directory, where python packages are installed in Colab.
        return False

    # If we're in dev mode, we should start a thread to watch the file for changes.
    if not _is_hmr_enabled():
        return False

    try:
        import watchfiles  # noqa: F401
    except ImportError:
        import warnings

        warnings.warn(
            "anywidget: Live-reloading feature is disabled."
            " To enable, please install the 'watchfiles' package.",
            stacklevel=2,
        )

        return False

    return True


def try_file_path(x: object) -> pathlib.Path | None:
    """If possible coerce x into a pathlib.Path object.

    If a string, we handle the following cases:

    - If it's a URL, return None.
    - If it's a multi-line string, return None.
    - If it's a single-line string with a file extension, return a pathlib.Path object.
    - Otherwise, return None.

    Parameters
    ----------
    x : Any
        The object to try to coerce into a pathlib.Path object.

    Returns
    -------
    pathlib.Path | None
        A pathlib.Path object if x is a file path, otherwise None.
    """
    # Already a pathlib.Path
    if isinstance(x, pathlib.Path):
        return x

    if not isinstance(x, str):
        return None

    # Handle the string

    # Ignore URLs
    if x.startswith(("http://", "https://")):
        return None

    # Ignore multi-line strings (probably raw file contents)
    is_multi_line = "\n" in x or "\r" in x
    if is_multi_line:
        return None

    # Is a single line string, but we don't know if it's a file path or raw contents.

    # Just check if it has a file extension for now.
    includes_file_suffix = re.search(r"[a-zA-Z0-9]\.[a-zA-Z0-9]+$", x) is not None
    if includes_file_suffix:
        return pathlib.Path(x).resolve().absolute()

    return None


def try_file_contents(x: object) -> FileContents | VirtualFileContents | None:
    """Try to coerce x into a FileContents object.

    Raises
    ------
    FileNotFoundError
        If the file is not found.
    """
    if isinstance(x, str) and x in _VIRTUAL_FILES:
        return _VIRTUAL_FILES[x]

    maybe_path = try_file_path(x)
    if maybe_path is None:
        return None

    path = maybe_path
    if not path.is_file():
        msg = f"File not found: {path}"
        raise FileNotFoundError(msg)
    return FileContents(
        path=path,
        start_thread=_should_start_thread(path),
    )


def repr_mimebundle(
    model_id: str,
    repr_text: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Create a MIME bundle for a widget representation."""
    data = {
        "text/plain": repr_text,
        _WIDGET_MIME_TYPE: {
            "version_major": _PROTOCOL_VERSION_MAJOR,
            "version_minor": _PROTOCOL_VERSION_MINOR,
            "model_id": model_id,
        },
    }
    return data, get_repr_metadata()
