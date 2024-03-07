---
"anywidget": patch
"@anywidget/types": patch
---

Add experimental reducer API for sending/await-ing custom messages

Introduces a unified API for dispatching messages from the front end, and
await-ing response from Python. This removes a lot of boilerplate required for
this kind of pattern previously. This API is experimental and opt-in, only if
`_experimental_anywidget_reducer` is implemented on the anywidget subclass.

```py
class Widget(anywidget.AnyWidget):
    _esm = """
    async function render({ model, el, experimental }) {
      let [response, buffers] = await experimental.dispatch("ping");
      // Handle the response
      console.log(response) // pong
    }
    export default { render };
    """

    def _experimental_anywidget_reducer(self, action, buffers):
        assert action == "ping"
        return "pong", []
```
