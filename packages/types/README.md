# @anywidget/types

> Type declarations for [**anywidget**](https://anywidget.dev)

## Installation

```sh
npm install @anywidget/types
```

## Usage

```javascript
/**
 * @typedef Model
 * @prop {number} value - the current count
 */

export default {
	/** @type {import("@anywidget/types").Initialize<Model>} */
	initialize({ model }) {
		let value = model.get("value");
		//^? number
	},
	/** @type {import("@anywidget/types").Render<Model>} */
	render({ model, el }) {
		let value = model.get("value");
		//^? number

		model.get("nope");
		// type error, `nope` is not defined on Model

		model.set("value", "not a number");
		//^? type error, must be a number
	}
}
```

## License

MIT
