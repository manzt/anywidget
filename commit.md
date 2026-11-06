Patch ipywidgets to accept anywidgets in Box and Link

`ipywidgets.Box.children` and `ipywidgets.{Directional,}Link.{source,target}`
do strict `isinstance(x, ipywidgets.Widget)` checks, which rejects
protocol-based anywidgets (those using `MimeBundleDescriptor` rather than
subclassing `Widget`). Users routinely want `HBox([my_anywidget])` and
`link((a, "x"), (b, "x"))` to just work; the new composition API in #974
solves anywidget-to-anywidget composition but leaves the bridge to
ipywidgets' built-in containers unsolved.

Mutating someone else's library at import time is a hack, but ipywidgets
is effectively frozen and "anywidgets are widgets" — the patch makes the
world correct rather than deceiving it. Applied eagerly from `__init__`
with a `_PATCHED` guard for idempotence. Only the high-traffic traits are
covered; obscure widget-ref traits (Tab, controllers, etc.) are deferred
until requested.
