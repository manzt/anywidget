import dataclasses

import psygnal
from anywidget._descriptor import ReprMimeBundle
from anywidget.experimental import MimeBundleDescriptor, dataclass, widget


def test_decorator() -> None:
    esm = "export default { render({ model , el }) {} }"
    css = ".foo { color: red;}"

    @widget(esm=esm, css=css)
    @psygnal.evented
    @dataclasses.dataclass
    class Foo:
        bar: str = "baz"

    foo = Foo()

    assert isinstance(Foo._repr_mimebundle_, MimeBundleDescriptor)  # type: ignore [reportAttributeAccessIssue]
    assert isinstance(foo._repr_mimebundle_, ReprMimeBundle)  # type: ignore [reportAttributeAccessIssue]


def test_dataclass() -> None:
    esm = "export function render({ model , el }) {}"
    css = ".foo { color: red;}"

    @dataclass(esm=esm, css=css)
    class Foo:
        bar: str = "baz"

    foo = Foo()

    assert isinstance(Foo._repr_mimebundle_, MimeBundleDescriptor)  # type: ignore [reportAttributeAccessIssue]
    assert isinstance(foo._repr_mimebundle_, ReprMimeBundle)  # type: ignore [reportAttributeAccessIssue]
