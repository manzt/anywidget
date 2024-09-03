from __future__ import annotations

import json
import pathlib
import sys
import time
from typing import Generator, NoReturn
from unittest.mock import MagicMock, patch

import anywidget
import pytest
import traitlets.traitlets as t
import watchfiles
from anywidget._file_contents import FileContents
from anywidget._util import _DEFAULT_ESM, _WIDGET_MIME_TYPE
from anywidget.experimental import command
from traitlets import traitlets
from watchfiles import Change

SELF_DIR = pathlib.Path(__file__).parent


def enable_hmr():  # noqa: ANN201
    return patch.dict("os.environ", {"ANYWIDGET_HMR": "1"}, clear=True)


def test_version() -> None:
    with (SELF_DIR / "../packages/anywidget/package.json").open() as f:
        pkg = json.load(f)

    assert anywidget.__version__ == pkg["version"]


def test_basic() -> None:
    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(esm).tag(sync=True)

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm


def test_default_esm() -> None:
    class Widget(anywidget.AnyWidget): ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == _DEFAULT_ESM


def test_creates_fully_qualified_identifier() -> None:
    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _module = t.Unicode(esm).tag(sync=True)

    w = Widget()

    assert w.has_trait("_anywidget_id")
    assert w._anywidget_id == "test_widget.Widget"


def test_infer_traitlets() -> None:
    css = """
    .foo { background-color: black; }
    """

    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = esm
        _css = css

    w = Widget()

    assert w.has_trait("_esm")
    assert w.trait_metadata("_esm", "sync")

    assert w.has_trait("_css")
    assert w.trait_metadata("_css", "sync")


def test_infer_traitlets_partial() -> None:
    css = """
    .foo { background-color: black; }
    """

    esm = """
    function render({ model, el }) {
        el.innerText = "Hello, world";
    }
    export default { render };
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(esm).tag(foo="bar")
        _css = css

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm
    assert w.trait_metadata("_esm", "foo") == "bar"

    assert w.has_trait("_css")
    assert w._css == css
    assert w.trait_metadata("_css", "sync")


def test_patched_repr_ipywidget_v8() -> None:
    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert bundle, "No view"
    assert bundle[0]
    assert _WIDGET_MIME_TYPE in bundle[0]
    assert bundle[1] == {}


def test_patched_repr_ipywidget_v8_colab(monkeypatch: pytest.MonkeyPatch) -> None:
    mock = MagicMock()
    mock._widgets._installed_url = "foo"
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert bundle, "No view"
    assert bundle[0]
    assert _WIDGET_MIME_TYPE in bundle[0]
    assert bundle[1] == {
        _WIDGET_MIME_TYPE: {
            "colab": {"custom_widget_manager": {"url": mock._widgets._installed_url}},
        },
    }


def test_infer_file_contents(tmp_path: pathlib.Path) -> None:
    esm = tmp_path / "foo.js"
    esm.write_text(
        "export default { render({ model, el }) { el.innerText = 'Hello, world'; } }",
    )

    site_packages = tmp_path / "site-packages"
    site_packages.mkdir()
    css = site_packages / "styles.css"
    css.write_text(".foo { background-color: black; }")

    with enable_hmr():

        class Widget(anywidget.AnyWidget):
            _esm = esm
            _css = str(css)

    assert isinstance(Widget._esm, FileContents)
    assert Widget._esm._background_thread is not None

    assert isinstance(Widget._css, FileContents)
    assert Widget._css._background_thread is None

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == esm.read_text()

    assert w.has_trait("_css")
    assert w._css == css.read_text()

    def mock_file_events() -> Generator[set]:
        css.write_text("blah")
        # write to file
        changes = set()
        changes.add((Change.modified, str(css)))
        yield changes
        # delete the file
        changes = set()
        changes.add((Change.deleted, str(css)))
        yield changes

    with patch.object(watchfiles, "watch") as mock_watch:
        mock_watch.return_value = mock_file_events()
        Widget._css.watch_in_thread()

    while Widget._css._background_thread and Widget._css._background_thread.is_alive():
        time.sleep(0.01)

    assert w._css == css.read_text()

    # need to teardown the thread for CI
    Widget._esm.stop_thread()


def test_missing_pathlib_path_raises(tmp_path: pathlib.Path) -> None:
    esm = tmp_path / "foo.js"

    with pytest.raises(FileNotFoundError):

        class Widget(anywidget.AnyWidget):
            _esm = esm


def test_missing_string_path_with_suffix_raises(tmp_path: pathlib.Path) -> None:
    str_path_with_suffix = str(tmp_path / "foo.js")

    with pytest.raises(FileNotFoundError):

        class Widget(anywidget.AnyWidget):
            _esm = str_path_with_suffix


def test_remote_contents() -> None:
    esm = "http://example.com/foo.js"
    css = "https://example.com/bar.css"

    class Widget(anywidget.AnyWidget):
        _esm = esm
        _css = css

    widget = Widget()
    assert widget._esm == esm
    assert widget._css == css


def test_missing_string_path_without_suffix_is_raw_string(
    tmp_path: pathlib.Path,
) -> None:
    str_path_without_suffix = str(tmp_path / "foo")

    class Widget(anywidget.AnyWidget):
        _esm = str_path_without_suffix

    assert Widget()._esm == str_path_without_suffix


def test_explicit_file_contents(tmp_path: pathlib.Path) -> None:
    path = tmp_path / "foo.js"
    path.write_text(
        "export default { render({ model, el }) { el.innerText = 'Hello, world'; } }",
    )
    esm = FileContents(path, start_thread=False)

    class Widget(anywidget.AnyWidget):
        _esm = esm

    assert Widget._esm == esm

    w = Widget()
    assert w._esm == path.read_text()


def test_dom_less_widget() -> None:
    class Widget(anywidget.AnyWidget):
        _view_name = traitlets.Any(None).tag(sync=True)
        _esm = """
        function render({ model, el }) {
            el.innerText = "Hello, world";
        }
        export default { render };
        """

    assert Widget()._repr_mimebundle_() is None


def test_command_not_registered_by_default() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = "export default { render(ctx) { ctx.el.innerText = 'Hello, world'; } }"

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 0


def test_anywidget_commands_register_one_callback() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = """
        export default {
            async render({ model, el, experimental }) {
                let [msg] = await experimental.invoke("_echo", "hi");
                let [msg] = await experimental.invoke("_echo2", "hi");
            }
        }
        """

        @command
        def _echo(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

        @command
        def _echo2(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 1


def test_supresses_error_in_constructor() -> None:
    class Widget(anywidget.AnyWidget):
        _esm = """
        export default {
            async render({ model, el, experimental }) {
                let [msg] = await experimental.invoke("_echo", "hi");
            }
        }
        """

        @command
        def _echo(
            self,
            msg: object,
            buffers: list[bytes],
        ) -> tuple[object, list[bytes]]:
            return msg, buffers

        @property
        def value(self) -> NoReturn:
            msg = "error"
            raise ValueError(msg)

    w = Widget()
    assert len(w._msg_callbacks.callbacks) == 1
