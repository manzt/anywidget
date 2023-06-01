---
"anywidget": minor
---

feat: Add support for evented msgspec.Struct objects

Our experimental descriptor API can now work with [`msgspec`](https://jcristharif.com/msgspec/), a fast and efficient serialization library, similar to `pydantic` but with a stronger emphasis on ser/de, and less on runtime casting of Python types.

```python
from anywidget._descriptor import MimeBundleDescriptor
import psygnal
import msgspec

@psygnal.evented
class Counter(msgspec.Struct, weakref=True):
    value: int = 0
    _repr_mimebundle_: ClassVar = MimeBundleDescriptor(_esm="index.js", autodetect_observer=False)
```
