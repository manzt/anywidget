---
"anywidget": patch
"@anywidget/types": patch
---

Add experimental `invoke` API to call Python functions from the front end and
await the response.

This removes a lot of boilerplate required for this pattern. The API is
experimental and opt-in only. Subclasses must use the `command` to register
functions.

```py
class Widget(anywidget.AnyWidget):
    _esm = """
    async function render({ model, el, experimental }) {
      let [msg, _buffers] = await experimental.invoke("_echo", "Hello, world");
    }
    export default { render };
    """

    @anywidget.experimental.command
    def _echo(self, msg, buffers):
        return msg, buffers
```
