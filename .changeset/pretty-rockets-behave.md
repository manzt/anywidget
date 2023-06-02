---
"anywidget": patch
---

feat: Add `anywidget.experimental` with simple decorator

```python
import dataclasses
import psygnal

from anywidget.experimental import widget

@widget(esm="index.js")
@psygnal.evented
@dataclasses.dataclass
class Counter:
    value: int = 0
```
