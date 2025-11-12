---
"anywidget": patch
---

Use rsbuild inline sourcemaps for JupyterLab extension

JupyterLab was refusing to load external source map files because they were
being served with the wrong MIME type ('application/octet-stream' instead of
the expected source map MIME type). This caused the extension to fail loading
in version 0.9.20.

Switching to inline source maps embeds the source map directly in the
JavaScript bundle, avoiding the MIME type issue while still providing source
map support for debugging.
