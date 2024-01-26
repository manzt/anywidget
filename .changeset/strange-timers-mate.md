---
"anywidget": minor
---

feat: Introduce front-end widget lifecycle methods

The preferred way to define a widget's front-end code is now with a `default`
object export.

```js
export default {
	initiailze({ model, el }) {
		/* ... */
	},
	render({ model, el }) {
		/* ... */
	},
};
```

Combined, these methods introduce lifecycle hooks for widget developers:

- `initialize`: is executed once when the widget front end first loads. The
  function has access to the `model` (no `el`), which can be set to setup event
  handlers / state to share across views created in render.
- `render`: is executed per _view_, or notebook output cell. This function has
  access to the `model` and a unique `el` for the output area. This method
  should be familiar, and can setup event handlers / access state specific to
  that view.

> [!WARNING] Exporting a named `render` from the front-end widget will trigger a
> deprecation notice in the browser console.
