from typing import Any, TypeVar, cast
from ipykernel.comm import Comm
from psygnal import EventedModel
from pydantic import PrivateAttr


class Displayable(EventedModel):
    _JUPYTER_MIME = "application/vnd.jupyter.widget-view+json"
    _MAX_REPR_SIZE = 110
    _PROTOCOL_VERSION_MAJOR = 2
    _PROTOCOL_VERSION_MINOR = 1
    _comm: Comm = PrivateAttr(default=None)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        version = f"{self._PROTOCOL_VERSION_MAJOR}.{self._PROTOCOL_VERSION_MINOR}"
        self._comm = Comm(
            target_name="jupyter.widget",
            metadata={"version": version},
            data={'state': self.get_state()},
        )

    def _repr_mimebundle_(self, **kwargs) -> dict:
        plaintext = repr(self)
        if len(plaintext) > self._MAX_REPR_SIZE:
            plaintext = f"{plaintext[:self._MAX_REPR_SIZE]}…"
        return {
            "text/plain": plaintext,
            self._JUPYTER_MIME: {
                "version_major": self._PROTOCOL_VERSION_MAJOR,
                "version_minor": self._PROTOCOL_VERSION_MINOR,
                "model_id": self._comm.comm_id,
            },
        }

    def get_state(self):
        return {
            **self.dict(),
            '_model_name': 'AnyModel',
            '_model_module': 'anywidget',
            '_view_name': 'AnyView',
            '_view_module': 'anywidget',
        }



        
    # def get_state(self, key: str = None):
    #     return { key: 10 }
        
    # def send_state(self, key=None):
    #     self._property_lock = None
    #     state = self.get_state(key=key)
    #     if len(state) > 0:
    #         if self._property_lock:  # we need to keep this dict up to date with the front-end values
    #             for name, value in state.items():
    #                 if name in self._property_lock:
    #                     self._property_lock[name] = value
    #         state, buffer_paths, buffers = _remove_buffers(state)
    #         msg = {'method': 'update', 'state': state, 'buffer_paths': buffer_paths}
    #         self._send(msg, buffers=buffers)

        
    # def _send(self, msg, buffers=None):
    #     self.comm.send(data=msg, buffers=buffers)


_BINARY_TYPES = (memoryview, bytearray, bytes)
T = TypeVar("T", list, dict, tuple)


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
    _sub: list | dict
    if isinstance(substate, (list, tuple)):
        _sub = list(substate)
        for i, v in enumerate(substate):
            if isinstance(v, _BINARY_TYPES):
                _sub[i] = None
                buffers.append(v)
                buffer_paths.append(path + [i])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [i], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    _sub[i] = _v
    elif isinstance(substate, dict):
        _sub = dict(substate)
        for k, v in substate.items():
            if isinstance(v, _BINARY_TYPES):
                del _sub[k]
                buffers.append(v)
                buffer_paths.append(path + [k])
            elif isinstance(v, (dict, list, tuple)):
                _v = _separate_buffers(cast("T", v), path + [k], buffer_paths, buffers)
                if v is not _v:  # only assign when value changed
                    _sub[k] = _v
    else:
        raise ValueError("expected state to be a list or dict, not %r" % substate)
    return _t(_sub)


def _remove_buffers(state: T) -> tuple[T, list[list], list[memoryview]]:
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
