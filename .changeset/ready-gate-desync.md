---
"anywidget": patch
---

Fix silent, permanent desync for widgets whose `_esm` takes more than 2 seconds to load. Front-end comm messages are no longer gated on the model's `ready` promise, which was rejected by a hard-coded 2-second timeout, causing every subsequent Python→JS message to be dropped while the widget continued to render. State updates now apply regardless of how long the widget takes to initialize.
