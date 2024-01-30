---
"anywidget": minor
---

Introduce front-end widget lifecycle methods

**Deprecation Notice**: Exporting a `render` from the front-end widget will
trigger a deprecation notice in the browser console. The preferred way to define
a widget's front-end code is now with a `default` object export.

```js
export default {
	initialize({ model }) {
		/* ... */
	},
	render({ model, el }) {
		/* ... */
	},
};
```

These methods introduce lifecycle hooks for widget developers:

- `initialize`: is executed once in the lifetime of a widget. It has access to
  the only the `model` to setup non-view event handlers or state to share across
  views.
- `render`: is executed once per _view_, or for each notebook output cell. It
  has access to the `model` _and_ a unique `el` DOM element. This method should
  be familiar and is used to setup event handlers or access state specific to
  that view.

The default export may also be a _function_ which returns (a Promise for) this
interface: This can be useful to setup some front-end specific state for the
lifecycle of the widget.

```js
export default () => {
	// Create a history of all the changes to the "value" trait
	let valueHistory = [];
	return {
		initialize({ model }) {
			// Push the new changes to history
			model.on("change:value", () => valueHistory.push(model.get("value")));
		},
		render({ model, el }) {
			el.innerText = `The history is ${valueHistory}`;
			// Update each view to display the current history
			model.on("change:value", () => {
				el.innerText = `The history is ${valueHistory}`;
			});
		},
	};
};
```
