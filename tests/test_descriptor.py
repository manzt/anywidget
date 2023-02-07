from dataclasses import dataclass
from typing import ClassVar
import weakref
from unittest.mock import MagicMock, patch

import pytest

import anywidget._descriptor
from anywidget._descriptor import (
    _COMMS,
    _JUPYTER_MIME,
    MimeBundleDescriptor,
    ReprMimeBundle,
)


class MockComm(MagicMock):
    # The only thing we need to do is to be able to relay messages back to
    # msg_callback, which is set by the descriptor using the on_msg method.

    msg_callback = None

    def on_msg(self, cb):
        self.msg_callback = cb

    def handle_msg(self, msg):
        if self.msg_callback is not None:
            self.msg_callback(msg)


@pytest.fixture
def mock_comm():
    """Mock a comm object."""
    comm = MockComm()
    assert not _COMMS
    with patch.object(anywidget._descriptor, "open_comm", return_value=comm):
        yield comm
    assert not _COMMS


def test_descriptor(mock_comm: MagicMock) -> None:
    """Test that the descriptor decorator makes a comm, and gets/sets state."""

    VAL = 1

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)
        value: int = VAL

        def _get_anywidget_state(self):
            return {"value": self.value}

    foo = Foo()
    mock_comm.send.assert_not_called()  # we haven't yet created a comm object

    repr_method = foo._repr_mimebundle_  # the comm is created here
    mock_comm.send.assert_called_once()
    assert isinstance(repr_method, ReprMimeBundle)
    assert _JUPYTER_MIME in repr_method()  # we can call it as usual

    # test that the comm sends update messages
    foo._repr_mimebundle_.send_state({"value"})
    mock_comm.send.assert_called_with(
        data={"method": "update", "state": {"value": VAL}, "buffer_paths": []},
        buffers=[],
    )

    # test that the object responds to incoming messages
    NEW_VAL = 3
    mock_comm.handle_msg(
        {"content": {"data": {"method": "update", "state": {"value": NEW_VAL}}}}
    )
    assert foo.value == NEW_VAL

    mock_comm.send.reset_mock()
    mock_comm.handle_msg({"content": {"data": {"method": "request_state"}}})
    mock_comm.send.assert_called()


def test_descriptor_sends_hmr_update(mock_comm: MagicMock) -> None:
    """Test that descriptor sends custom anywidget HMR update to front end."""

    esm = "export function render(view) {}"
    css = "h1 { }"

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)
        value: int = 0

        def _get_anywidget_state(self):
            return {"value": self.value}

    foo = Foo()

    foo._repr_mimebundle_._send_hmr_update(esm=esm, css=css)
    mock_comm.send.assert_called_with(
        data={
            "method": "update",
            "state": {"_esm": esm, "_css": css},
            "buffer_paths": [],
        },
        buffers=[],
    )

    foo._repr_mimebundle_._send_hmr_update(esm=esm)
    mock_comm.send.assert_called_with(
        data={"method": "update", "state": {"_esm": esm}, "buffer_paths": []},
        buffers=[],
    )

    foo._repr_mimebundle_._send_hmr_update(css=css)
    mock_comm.send.assert_called_with(
        data={"method": "update", "state": {"_css": css}, "buffer_paths": []},
        buffers=[],
    )

    foo._repr_mimebundle_._send_hmr_update()
    mock_comm.send.assert_not_called


def test_state_setter(mock_comm: MagicMock):
    """Test that `_set_anywidget_state` is used when present."""
    mock = MagicMock()

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)

        def _get_anywidget_state(self):
            return {}

        def _set_anywidget_state(self, state):
            mock(state)

    foo = Foo()
    foo._repr_mimebundle_
    state = {"value": 7}
    mock_comm.handle_msg({"content": {"data": {"method": "update", "state": state}}})
    mock.assert_called_once_with(state)


def test_comm_cleanup():
    """Test that the comm is cleaned up when the object is deleted."""
    assert not _COMMS

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)

        def _get_anywidget_state(self):
            return {}

    foo = Foo()
    foo_ref = weakref.ref(foo)
    id_foo = id(foo)
    assert id_foo not in _COMMS
    repr_obj = foo._repr_mimebundle_
    assert id_foo in _COMMS
    del foo  # this should trigger the cleanup

    assert not _COMMS  # the comm should be gone
    assert foo_ref() is None  # the ref should be dead

    # setting this just so that we can test the following exception
    repr_obj._autodetect_observer = True
    with pytest.raises(RuntimeError):
        repr_obj.sync_object_with_view()


def test_detect_observer():
    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor()

        def _get_anywidget_state(self):
            return {}

    with pytest.warns(UserWarning, match="Could not find a notifier"):
        Foo()._repr_mimebundle_


def test_descriptor_on_slots() -> None:
    """Make sure that strict classes don't break the descriptor altogether."""

    class Foo:
        __slots__ = ()

        _repr_mimebundle_ = MimeBundleDescriptor()
        value: int = 1

        def _get_anywidget_state(self):
            return {"value": self.value}

    with pytest.warns(UserWarning, match=".*is not weakrefable"):
        Foo()._repr_mimebundle_

    # this test has the potential to leave a comm in _COMMS, so we clear it
    # to avoid polluting other tests
    _COMMS.clear()


def test_descriptor_with_psygnal(mock_comm: MagicMock):
    """Test that the observer pattern is found on psygnal.evented dataclasses."""
    psygnal = pytest.importorskip("psygnal")

    @psygnal.evented
    @dataclass
    class Foo:
        value: int = 1
        _repr_mimebundle_ = MimeBundleDescriptor()

    foo = Foo()
    repr_obj = foo._repr_mimebundle_  # create the comm

    mock_comm.send.reset_mock()
    foo.value = 2
    assert foo.value == 2
    mock_comm.send.assert_called_once_with(
        data={"method": "update", "state": {"value": 2}, "buffer_paths": []},
        buffers=[],
    )

    with pytest.warns(UserWarning, match="Refusing to re-sync a synced object"):
        repr_obj.sync_object_with_view()

    assert repr_obj._disconnectors
    del foo
    assert not repr_obj._disconnectors


def test_descriptor_with_pydantic(mock_comm: MagicMock):
    pydantic = pytest.importorskip("pydantic")

    VAL = 1

    class Foo(pydantic.BaseModel):
        __slots__ = ("__weakref__",)
        value: int = VAL

        _repr_mimebundle_: ClassVar = MimeBundleDescriptor(autodetect_observer=False)

    foo = Foo()
    foo._repr_mimebundle_  # create the comm

    # test that the comm sends update messages
    foo._repr_mimebundle_.send_state({"value"})
    mock_comm.send.assert_called_with(
        data={"method": "update", "state": {"value": VAL}, "buffer_paths": []},
        buffers=[],
    )

    # test that the object responds to incoming messages
    NEW_VAL = 3
    mock_comm.handle_msg(
        {"content": {"data": {"method": "update", "state": {"value": NEW_VAL}}}}
    )
    assert foo.value == NEW_VAL


def test_descriptor_with_traitlets(mock_comm: MagicMock):
    import traitlets

    class Foo(traitlets.HasTraits):
        value = traitlets.Int(0).tag(sync=True)
        _repr_mimebundle_ = MimeBundleDescriptor()

    foo = Foo()
    repr_obj = foo._repr_mimebundle_  # create the comm
    mock_comm.send.reset_mock()

    foo.value = 2
    assert foo.value == 2
    mock_comm.send.assert_called_once_with(
        data={"method": "update", "state": {"value": 2}, "buffer_paths": []},
        buffers=[],
    )

    assert repr_obj._disconnectors
    mock_comm.send.reset_mock()
    repr_obj.unsync_object_with_view()
    foo.value = 5
    mock_comm.assert_not_called()
    assert not repr_obj._disconnectors
