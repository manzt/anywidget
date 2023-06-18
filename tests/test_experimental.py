import dataclasses

import psygnal
from anywidget._descriptor import ReprMimeBundle
from anywidget.experimental import MimeBundleDescriptor, widget


def test_decorator():
    esm = "export function render({ model , el }) {}"
    css = ".foo { color: red;}"

    @widget(esm=esm, css=css)
    @psygnal.evented
    @dataclasses.dataclass
    class Foo:
        bar: str = "baz"

    foo = Foo()

    assert isinstance(Foo._repr_mimebundle_, MimeBundleDescriptor)  # type: ignore
    assert isinstance(foo._repr_mimebundle_, ReprMimeBundle)  # type: ignore
