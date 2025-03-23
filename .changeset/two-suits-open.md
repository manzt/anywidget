---
"anywidget": patch
---

Improve robustness of HMR file watching

Handles cases where atomic saves (e.g. by VS Code) temporarily delete and replace the file. The watcher now ensures the file does not exist on `Change.delete` events, preventing unexpected drops in hot reload behavior.
