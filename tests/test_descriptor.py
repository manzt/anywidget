import pathlib
import time
import weakref
from dataclasses import dataclass
from typing import TYPE_CHECKING, ClassVar, Set, Union
from unittest.mock import MagicMock, patch

import anywidget._descriptor
import pytest
import watchfiles
from anywidget._descriptor import (
    _COMMS,
    MimeBundleDescriptor,
    ReprMimeBundle,
)
from anywidget._file_contents import FileContents
from anywidget._util import _WIDGET_MIME_TYPE
from watchfiles import Change

if TYPE_CHECKING:
    from anywidget._protocols import AnywidgetProtocol
    from ipykernel.comm import Comm


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


def _send_value(comm: "Comm", value: int) -> int:
    # test that the object responds to incoming messages
    comm.handle_msg(
        {"content": {"data": {"method": "update", "state": {"value": value}}}}
    )
    return value


def _assert_sends_update(wdg: "AnywidgetProtocol", comm: MagicMock, expect: int):
    # test that the comm sends update messages
    wdg._repr_mimebundle_.send_state({"value"})
    comm.send.assert_called_with(
        data={"method": "update", "state": {"value": expect}, "buffer_paths": []},
        buffers=[],
    )


def test_descriptor(mock_comm: MagicMock) -> None:
    """Test that the descriptor decorator makes a comm, and gets/sets state."""

    VAL = 1
    REPR = "FOO"

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)
        value: int = VAL

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {"value": self.value}

        def __repr__(self) -> str:
            return REPR

    foo = Foo()
    mock_comm.send.assert_not_called()  # we haven't yet created a comm object

    repr_method = foo._repr_mimebundle_  # the comm is created here
    mock_comm.send.assert_called_once()
    assert isinstance(repr_method, ReprMimeBundle)
    bundle = repr_method()
    assert _WIDGET_MIME_TYPE in bundle[0]  # we can call it as usual
    assert len(bundle[1]) == 0

    # test that the comm sends update messages
    _assert_sends_update(foo, mock_comm, VAL)

    # test that the object responds to incoming messages
    assert _send_value(mock_comm, 3) == foo.value

    mock_comm.send.reset_mock()
    mock_comm.handle_msg({"content": {"data": {"method": "request_state"}}})
    mock_comm.send.assert_called()

    # uses the base class repr for plain text
    assert foo._repr_mimebundle_()[0]["text/plain"] == REPR


def test_state_setter(mock_comm: MagicMock):
    """Test that `_set_anywidget_state` is used when present."""
    mock = MagicMock()

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {}

        def _set_anywidget_state(self, state):
            mock(state)

    foo = Foo()
    foo._repr_mimebundle_
    state = {"value": 7}
    mock_comm.handle_msg({"content": {"data": {"method": "update", "state": state}}})
    mock.assert_called_once_with(state)


def test_state_setter_binary(mock_comm: MagicMock):
    """Test that `_set_anywidget_state` is used when present."""
    mock = MagicMock()

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {}

        def _set_anywidget_state(self, state):
            mock(state)

    foo = Foo()
    foo._repr_mimebundle_
    mock_comm.handle_msg(
        {
            "content": {
                "data": {"method": "update", "state": {}, "buffer_paths": [["value"]]}
            },
            "buffers": [b"hello"],
        }
    )
    mock.assert_called_once_with({"value": b"hello"})


def test_comm_cleanup():
    """Test that the comm is cleaned up when the object is deleted."""
    assert not _COMMS

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)

        def _get_anywidget_state(self, include: Union[Set[str], None]):
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

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {}

    with pytest.warns(UserWarning, match="Could not find a notifier"):
        Foo()._repr_mimebundle_


def test_descriptor_on_slots() -> None:
    """Make sure that strict classes don't break the descriptor altogether."""

    class Foo:
        __slots__ = ()

        _repr_mimebundle_ = MimeBundleDescriptor(autodetect_observer=False)
        value: int = 1

        def _get_anywidget_state(self, include: Union[Set[str], None]):
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
    if TYPE_CHECKING:
        import pydantic
    else:
        pydantic = pytest.importorskip("pydantic")

    VAL = 1

    class Foo(pydantic.BaseModel):
        __slots__ = ("__weakref__",)
        value: int = VAL

        _repr_mimebundle_: ClassVar = MimeBundleDescriptor(autodetect_observer=False)

    foo = Foo()
    foo._repr_mimebundle_  # create the comm

    # test that the comm sends update messages
    _assert_sends_update(foo, mock_comm, VAL)

    # test that the object responds to incoming messages
    assert _send_value(mock_comm, 3) == foo.value


def test_descriptor_with_msgspec(mock_comm: MagicMock):
    if TYPE_CHECKING:
        import msgspec
        import psygnal
    else:
        psygnal = pytest.importorskip("psygnal")
        msgspec = pytest.importorskip("msgspec")

    VAL = 1

    @psygnal.evented
    class Foo(msgspec.Struct, weakref=True):
        value: int = VAL
        _repr_mimebundle_: ClassVar = MimeBundleDescriptor(autodetect_observer=False)

    foo = Foo()
    foo._repr_mimebundle_  # create the comm

    # test that the comm sends update messages
    _assert_sends_update(foo, mock_comm, VAL)

    # test that the object responds to incoming messages
    assert _send_value(mock_comm, 3) == foo.value


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


def test_infer_file_contents(mock_comm: MagicMock, tmp_path: pathlib.Path) -> None:
    """Test that the file contents are inferred from the file path."""

    site_packages = tmp_path / "site-packages"
    site_packages.mkdir()

    esm = site_packages / "foo.js"
    esm.write_text(
        "export default { render({ model, el }) { el.innerText = 'Hello, world'; } }"
    )

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(_esm=esm, autodetect_observer=False)
        value: int = 1

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {"value": self.value}

    file_contents = Foo._repr_mimebundle_._extra_state["_esm"]
    assert isinstance(file_contents, FileContents)
    assert file_contents._background_thread is None

    foo = Foo()
    assert foo._repr_mimebundle_._extra_state["_esm"] == esm.read_text()

    def mock_file_events():
        esm.write_text("blah")
        # write to file
        changes = set()
        changes.add((Change.modified, str(esm)))
        yield changes
        # delete the file
        changes = set()
        changes.add((Change.deleted, str(esm)))
        yield changes

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        file_contents.watch_in_thread()

    while (
        file_contents._background_thread and file_contents._background_thread.is_alive()
    ):
        time.sleep(0.01)

    mock_comm.send.assert_called_with(
        data={"method": "update", "state": {"_esm": "blah"}, "buffer_paths": []},
        buffers=[],
    )


def test_explicit_file_contents(tmp_path: pathlib.Path) -> None:
    """Test that the file contents are inferred from the file path."""

    path = tmp_path / "bar.txt"
    path.write_text("Hello, world")

    bar = FileContents(path, start_thread=False)

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(bar=bar, autodetect_observer=False)
        value: int = 1

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {"value": self.value}

    file_contents = Foo._repr_mimebundle_._extra_state["bar"]
    assert file_contents == bar
    assert file_contents._background_thread is None

    foo = Foo()
    assert foo._repr_mimebundle_._extra_state["bar"] == path.read_text()


def test_no_view():
    """Test that the descriptor works without a view."""

    esm = """
    export function initialize({ model }) {
        model.on("msg:custom", (msg) => console.log(msg));
    }
    """

    class Foo:
        _repr_mimebundle_ = MimeBundleDescriptor(
            _esm=esm, no_view=True, autodetect_observer=False
        )

        def _get_anywidget_state(self, include: Union[Set[str], None]):
            return {}

    foo = Foo()
    assert foo._repr_mimebundle_() is None
