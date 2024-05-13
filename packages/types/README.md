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

/** @type {import("@anywidget/types").AnyWidget<Model>} */
export default {
	initialize({ model }) {
		let value = model.get("value");
		//^? number
	},
	render({ model, el }) {
		let value = model.get("value");
		//^? number

		model.get("nope");
		// type error, `nope` is not defined on Model

		model.set("value", "not a number");
		//^? type error, must be a number
	},
};
```

## License

MIT
