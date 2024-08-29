---
"@anywidget/types": minor
---

Makes explicit WidgetManager interface

Drops `@jupyter-widgets/base` as a dependency and instead makes an explicit
interface for `AnyModel.widget_manager`. Right now we only support
`widget_manager.get_model`, so having the other methods on the interface was
misleading (leading to issues around `.create_view` not being supported).
