---
"anywidget": patch
---

Walk widget state without probing every value for widget references. Since #1034, serializing state on the `MimeBundleDescriptor` path ran an import for every value in the state dict, making each `send_state` about 2.8x slower than before. The reference helpers now live in `_descriptor.py` with ordinary imports, and plain values and containers are handled before anything is checked for a widget, so a large state serializes about 4x faster than before #1034.
