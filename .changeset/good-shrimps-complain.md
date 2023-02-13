---
"anywidget": patch
---

feat: add `FileContents` to read/watch files (#62)

```python
contents = FileContents("./index.js", start_thread=True)

contents.changed.connect
def _on_change(new_contents: str):
    print("index.js changed:")
    print(new_contents)
```
