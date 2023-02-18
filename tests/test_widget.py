import json
import pathlib
import sys
from unittest.mock import MagicMock

import anywidget
import pytest
import traitlets.traitlets as t
from anywidget._util import _WIDGET_MIME_TYPE
from anywidget.widget import DEFAULT_ESM


def test_version():
    with open(pathlib.Path(__file__).parent / "../package.json") as f:
        pkg = json.load(f)

    assert anywidget.__version__ == pkg["version"]


def test_basic():
    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(ESM).tag(sync=True)

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == ESM


def test_default_esm():
    class Widget(anywidget.AnyWidget):
        ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == DEFAULT_ESM


def test_creates_fully_qualified_identifier():
    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    class Widget(anywidget.AnyWidget):
        _module = t.Unicode(ESM).tag(sync=True)

    w = Widget()

    assert w.has_trait("_anywidget_id")
    assert w._anywidget_id == "test_widget.Widget"


def test_infer_traitlets():
    CSS = """
    .foo { background-color: black; }
    """

    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    class Widget(anywidget.AnyWidget):
        _esm = ESM
        _css = CSS

    w = Widget()

    assert w.has_trait("_esm")
    assert w.trait_metadata("_esm", "sync")

    assert w.has_trait("_css")
    assert w.trait_metadata("_css", "sync")


def test_infer_traitlets_partial():
    CSS = """
    .foo { background-color: black; }
    """

    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    class Widget(anywidget.AnyWidget):
        _esm = t.Unicode(ESM).tag(foo="bar")
        _css = CSS

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == ESM
    assert w.trait_metadata("_esm", "foo") == "bar"

    assert w.has_trait("_css")
    assert w._css == CSS
    assert w.trait_metadata("_css", "sync")


def test_patched_repr_ipywidget_v8(monkeypatch: pytest.MonkeyPatch):
    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert bundle[0] and _WIDGET_MIME_TYPE in bundle[0]
    assert bundle[1] == {}

    mock = MagicMock()
    mock._installed_url = "foo"
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    w = anywidget.AnyWidget()
    assert mock.enable_custom_widget_manager.called_once

    bundle = w._repr_mimebundle_()
    assert bundle[0] and _WIDGET_MIME_TYPE in bundle[0]
    assert _WIDGET_MIME_TYPE in bundle[1]
