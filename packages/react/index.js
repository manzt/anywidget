// @ts-check
import * as React from "react";
import * as ReactDOM from "react-dom/client";

/** @type {React.Context<import("@anywidget/types").AnyModel>} */
let ModelContext = React.createContext(/** @type {any} */ (null));

export function useModel() {
	let model = React.useContext(ModelContext);
	if (!model) throw new Error("Model not found");
	return model;
}

/**
 * @template T
 *
 * @param {string} key
 * @returns {[T, (value: T) => void]}
 */
export function useModelState(key) {
	let model = useModel();
	let [value, setValue] = React.useState(model.get(key));
	React.useEffect(() => {
		let callback = () => setValue(model.get(key));
		model.on(`change:${key}`, callback);
		return () => model.off(`change:${key}`, callback);
	}, [model, key]);
	return [
		value,
		(value) => {
			model.set(key, value);
			model.save_changes();
		},
	];
}

/**
 * @param {React.FC} Widget
 * @returns {import("@anywidget/types").Render}
 */
export function createRender(Widget) {
	return ({ model, el }) => {
		let root = ReactDOM.createRoot(el);
		root.render(
			React.createElement(
				React.StrictMode,
				null,
				React.createElement(
					ModelContext.Provider,
					{ value: model },
					React.createElement(Widget),
				),
			),
		);
		return () => root.unmount();
	};
}
