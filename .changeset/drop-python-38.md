---
"anywidget": minor
---

Drop Python 3.8 and 3.9 support, require Python >=3.10

Python 3.8 and 3.9 have reached end-of-life. Bumping the minimum to 3.10 aligns anywidget with the broader ecosystem and allows us to upgrade dependencies (like `watchfiles`) that have already dropped older Python support, which is needed for Python 3.14 compatibility.
