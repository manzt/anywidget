---
"anywidget": minor
"@anywidget/types": minor
---

feat!: Limit view fields exposed to render function

BREAKING: The render function's argument has been refactored from a full `AnyView` to a simple object. This object only exposes the `model` and `el` fields to the user-provided `render` function. This change aims to simplify the API and reduce potential misuse. Please ensure your render function only depends on these fields.
