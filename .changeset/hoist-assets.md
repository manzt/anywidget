---
"anywidget": minor
---

Add opt-in `ANYWIDGET_SHARED_ASSETS=1` to share `_esm` and `_css` across widget instances

When enabled, each distinct class-level `_esm`/`_css` value is opened once as a shared asset and widget state refers to it instead of inlining the source. Source crosses the wire once per front end, and a module is evaluated once per distinct `_esm` value rather than per instance (#613, #1031), so module-scope state is shared; per-instance state belongs in `initialize`. With the flag on, `widget._esm` and `widget._css` hold the shared asset rather than a string; `str(widget._esm)` returns the source, and an asset cannot be swapped for inline source after construction. Hosts opt in with `anywidget.hosts.configure(shared_assets=True)`; an explicitly set `ANYWIDGET_SHARED_ASSETS` overrides the host either way, so the variable stays a kill switch. A host that serves several front ends from one process names the current one with `configure(scope=...)`; if a host registers `Widget.on_widget_constructed` without doing so, sharing stays off. A host that reads `_esm` or `_css` off widget state will see an asset reference to resolve:

```js
let value = model.get("_esm"); // source, or "anywidget-asset:<id>"
if (value.startsWith("anywidget-asset:")) {
  let asset = await manager.get_model(value.slice("anywidget-asset:".length));
  esm = asset.get("contents");
  asset.on("change:contents", reload); // hot reload flows through the asset
}
```

Off by default in this release.
