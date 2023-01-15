import pathlib

from anywidget import AnyWidget, anywidget


def test_basic():

    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    @anywidget(esm=ESM)
    class Widget:
        ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == ESM
    assert not w.has_trait("_css")
    assert isinstance(w, AnyWidget)


def test_basic_with_css():
    CSS = ".btn { background-color: red; }"

    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    @anywidget(esm=ESM, css=CSS)
    class Widget:
        ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == ESM
    assert w.has_trait("_css")
    assert w._css == CSS
    assert isinstance(w, AnyWidget)


def test_reads_from_file(tmp_path: pathlib.Path):
    CSS = ".btn { background-color: red; }"

    ESM = """
    export function render(view) {
        view.el.innerText = "Hello, world";
    }
    """

    with open(tmp_path / "index.js", mode="w") as f:
        f.write(ESM)

    with open(tmp_path / "styles.css", mode="w") as f:
        f.write(CSS)

    @anywidget(esm=tmp_path / "index.js", css=tmp_path / "styles.css")
    class Widget:
        ...

    w = Widget()

    assert w.has_trait("_esm")
    assert w._esm == ESM
    assert w.has_trait("_css")
    assert w._css == CSS
    assert isinstance(w, AnyWidget)
