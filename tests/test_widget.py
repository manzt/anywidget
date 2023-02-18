import json
import pathlib

import anywidget
import traitlets.traitlets as t
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
