---
"anywidget": patch
---

Fix silent, permanent desync for widgets whose `_esm` takes more than 2 seconds to load. Front-end comm messages are no longer gated on the model's `ready` promise, which was rejected by a hard-coded 2-second timeout, causing every subsequent Python→JS message to be dropped while the widget continued to render. State updates now apply regardless of how long the widget takes to initialize. Because messages are no longer held back, a custom message (`Widget.send`) that reaches the front end before the widget's module has finished loading is dropped instead of delivered to `initialize`'s `msg:custom` listeners, matching the behaviour before anywidget 0.9.14. Widgets should read state in `render` rather than rely on events sent during load.
