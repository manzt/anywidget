---
"anywidget": patch
---

feat(experimental)!: Require `include` in `_get_anywidget_state` signature

Allows implementors to avoid re-serializing fields which aren't needed to send
to the front end. This is a BREAKING change because it requires implementors of
`_get_anywidget_state` to account for `include` in the function signature.

```python
from dataclasses import dataclass, asdict
from io import BytesIO

import polars as pl
import psygnal

@psygnal.evented
@dataclass
class Foo:
  value: int
  df: pl.DataFrame

  def _get_anywidget_state(self, include: set[str] | None):
    data = asdict(self)
    if include and "df" in include:
      with BytesIO() as f:
        self.df.write_ipc(f)
        data["df"] = f.getvalue()
    else:
      del data["df"] # don't serialize df to bytes
    return data
```
