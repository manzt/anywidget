from __future__ import annotations

import contextlib
import pathlib
import sys
from functools import lru_cache
from typing import Any

from ._file_contents import FileContents

_BINARY_TYPES = (memoryview, bytearray, bytes)
_WIDGET_MIME_TYPE = "application/vnd.jupyter.widget-view+json"
_ANYWIDGET_ID_KEY = "_anywidget_id"
_ESM_KEY = "_esm"
_CSS_KEY = "_css"
_DEFAULT_ESM = """
export function render(view) {
  console.log("Dev note: No _esm defined for this widget:", view);
  let url = "https://anywidget.dev/en/getting-started/";
  view.el.innerHTML = `<p>
    <strong>Dev note</strong>:
    <a href='${url}' target='blank'>Implement an <code>_esm</code> attribute</a>
    on AnyWidget subclass <code>${view.model.get('_anywidget_id')}</code>
    to customize this widget.
  </p>`;
}
"""

# next 3 functions vendored with modifications from ipywidgets
# BSD-3-Clause
# Copyright (c) 2015 Project Jupyter Contributors
# https://github.com/jupyter-widgets/ipywidgets/blob/7325e5952efb71bd69692b2d7ed815646c0ac521/python/ipywidgets/ipywidgets/widgets/widget.py


def _separate_buffers(
    substate: Any, path: list, buffer_paths: list, buffers: list
) -> Any:
    """For internal, see _remove_buffers.

    remove binary types from dicts and lists, but keep track of their paths any part of
    the dict/list that needs modification will be cloned, so the original stays
    untouched e.g. {'x': {'ar': ar}, 'y': [ar2, ar3]}, where ar/ar2/ar3 are binary types
    will result in {'x': {}, 'y': [None, None]}, [ar, ar2, ar3], [['x', 'ar'], ['y', 0],
    ['y', 1]] instead of removing elements from the list, this will make replacing the
    buffers on the js side much easier
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
        raise ValueError(f"expected state to be a list or dict, not {substate!r}")
    return _sub if _sub is not None else substate


def remove_buffers(state: Any) -> tuple[Any, list[list], list[memoryview]]:
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
    url = sys.modules["google.colab.output"]._widgets._installed_url

    if url is None:
        return {}

    return {_WIDGET_MIME_TYPE: {"colab": {"custom_widget_manager": {"url": url}}}}


def _should_start_thread(path: pathlib.Path) -> bool:
    if "site-packages" in path.parts:
        # file is inside site-packages, likely not a local development install
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


def try_file_contents(x: Any) -> FileContents | None:
    """Try to coerce x into a FileContents object."""
    if not isinstance(x, (str, pathlib.Path)):
        return None

    maybe_path = pathlib.Path(x)

    # Could raise OSError if not a path and exceeds max path length
    with contextlib.suppress(OSError):
        maybe_path = pathlib.Path(maybe_path).resolve().absolute()
        if maybe_path.is_file():
            return FileContents(
                path=maybe_path,
                start_thread=_should_start_thread(maybe_path),
            )

    return None
