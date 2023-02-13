---
"anywidget": patch
---

feat: add `MimeBundleDescriptor` pattern, for more library agnostic Python <> JS communication (#49)

```python
from anywidget._descriptor import MimeBundleDescriptor

import traitlets

class Counter(traitlets.HasTraits):
    _repr_mimebundle_ = MimeBundleDescriptor(_esm=ESM)
    value = traitlets.Int(0).tag(sync=True)


from dataclasses import dataclass
from psygnal import evented

@evented
@dataclass
class Counter:
    _repr_mimebundle_ = MimeBundleDescriptor(_esm=ESM)
    value: int = 0
```
