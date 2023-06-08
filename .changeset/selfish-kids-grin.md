---
"anywidget": patch
---

fix: Specify UTF-8 encoding in `FileContents.__str__`

Fixes an `UnicodeDecodeError` observed on Windows when special characters are present in `_esm` or `_css` elements of a widget.
