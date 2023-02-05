from __future__ import annotations

from typing import TypeVar, cast


_BINARY_TYPES = (memoryview, bytearray, bytes)
T = TypeVar("T", list, dict, tuple)


# next 3 functions vendored with modifications from ipywidgets
# BSD-3-Clause
# Copyright (c) 2015 Project Jupyter Contributors
# https://github.com/jupyter-widgets/ipywidgets/blob/7325e5952efb71bd69692b2d7ed815646c0ac521/python/ipywidgets/ipywidgets/widgets/widget.py


def _separate_buffers(substate: T, path: list, buffer_paths: list, buffers: list) -> T:
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
                buffer_paths.append(path + [i])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [i], buffer_paths, buffers)
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
                buffer_paths.append(path + [k])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [k], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    if _sub is None:
                        _sub = dict(substate)  # shallow clone dict
                    _sub[k] = _v
    else:  # pragma: no cover
        raise ValueError(f"expected state to be a list or dict, not {substate!r}")
    return _sub if _sub is not None else substate


def remove_buffers(state: T) -> tuple[T, list[list], list[memoryview]]:
    """Return (state_without_buffers, buffer_paths, buffers) for binary message parts

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
):
    """The inverse of _remove_buffers, except here we modify the existing dict/lists.
    Modifying should be fine, since this is used when state comes from the wire.
    """
    for buffer_path, buffer in zip(buffer_paths, buffers):
        # we'd like to set say sync_data['x'][0]['y'] = buffer
        # where buffer_path in this example would be ['x', 0, 'y']
        obj = state
        for key in buffer_path[:-1]:
            obj = obj[key]
        obj[buffer_path[-1]] = buffer
