---
"anywidget": patch
---

Fix `comm_open` for protocol widgets (`MimeBundleDescriptor`) whose `_css` is a file path. The comm opened inside the loop that converts `_esm` and `_css` to source text, so only the first key was converted and the open message carried the raw file object for the second. The comm now opens after every value has been converted.
