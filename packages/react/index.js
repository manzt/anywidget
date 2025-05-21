import * as React from "react";
import * as ReactDOM from "react-dom/client";

/**
 * @template {Record<string, any>} T
 * @typedef RenderContext
 * @property {import("@anywidget/types").AnyModel<T>} model
 * @property {import("@anywidget/types").Experimental} experimental
 */

/** @type {React.Context<RenderContext<any>>} */
let RenderContext = React.createContext(/** @type {any} */ (null));

/**
 * @returns {RenderContext<any>}
 */
function useRenderContext() {
	let ctx = React.useContext(RenderContext);
	if (!ctx) throw new Error("RenderContext not found");
	return ctx;
}

/**
 * @template {Record<string, any>} T
 * @returns {import("@anywidget/types").AnyModel<T>}
 */
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
 * A React Hook to use model-backed state in a component.
 *
 * Mirrors the API of `React.useState`, but synchronizes state with
 * the underlying model provided by an anywidget host.
 *
 * @example
 * ```ts
 * import * as React from "react";
 * import { useModelState } from "@anywidget/react";
 *
 * function Counter() {
 *   let [value, setValue] = useModelState<number>("value");
 *
 *   return (
 *     <button onClick={() => setValue((v) => v + 1)}>
 *       Count: {value}
 *     </button>
 *   );
 * }
 * ```
 *
 * @template S
 * @param {string} key - The name of the model field to use
 * @returns {[S, React.Dispatch<React.SetStateAction<S>>]}
 */
export function useModelState(key) {
	let model = useModel();
	let value = React.useSyncExternalStore(
		(update) => {
			model.on(`change:${key}`, update);
			return () => model.off(`change:${key}`, update);
		},
		() => model.get(key),
	);
	/** @type {React.Dispatch<React.SetStateAction<S>>} */
	let setValue = React.useCallback(
		(value) => {
			model.set(
				key,
				// @ts-expect-error - TS cannot correctly narrow type
				typeof value === "function" ? value(model.get(key)) : value,
			);
			model.save_changes();
		},
		[model, key],
	);
	return [value, setValue];
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
