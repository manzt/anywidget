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


def test_enables_widget_manager_in_colab(monkeypatch: pytest.MonkeyPatch):
    mock = MagicMock()
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    anywidget.AnyWidget()._repr_mimebundle_()
    anywidget.AnyWidget()._repr_mimebundle_()
    assert mock.enable_custom_widget_manager.assert_called_once


def test_injects_colab_meta(monkeypatch: pytest.MonkeyPatch):
    mock = MagicMock()
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert _WIDGET_MIME_TYPE in bundle[1]
    assert "colab" in bundle[1][_WIDGET_MIME_TYPE]


def test_empty_meta():
    w = anywidget.AnyWidget()
    bundle = w._repr_mimebundle_()
    assert len(bundle[1]) == 0


def test_default_no_ipython_display():
    w = anywidget.AnyWidget()
    assert not hasattr(w, "")
