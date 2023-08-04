---
"anywidget": patch
---

feat(experimental): add `@dataclass` decorator

```python
from anywidget.experimental import dataclass

@dataclass(esm="index.js")
class Counter:
    value: int = 0

Counter()
```
