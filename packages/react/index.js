import * as React from "react";
import * as ReactDOM from "react-dom/client";

/**
 * @typedef RenderContext
 * @property {import("@anywidget/types").AnyModel} model
 * @property {import("@anywidget/types").Experimental} experimental
 */

/** @type {React.Context<RenderContext>} */
let RenderContext = React.createContext(/** @type {any} */ (null));

/** @returns {RenderContext} */
function useRenderContext() {
	let ctx = React.useContext(RenderContext);
	if (!ctx) throw new Error("RenderContext not found");
	return ctx;
}

/** @returns {import("@anywidget/types").AnyModel} */
export function useModel() {
	let ctx = useRenderContext();
	return ctx.model;
}

/** @returns {import("@anywidget/types").Experimental} */
export function useExperimental() {
	let ctx = useRenderContext();
	return ctx.experimental;
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
	return ({ el, model, experimental }) => {
		let root = ReactDOM.createRoot(el);
		root.render(
			React.createElement(
				React.StrictMode,
				null,
				React.createElement(
					RenderContext.Provider,
					{ value: { model, experimental } },
					React.createElement(Widget),
				),
			),
		);
		return () => root.unmount();
	};
}
