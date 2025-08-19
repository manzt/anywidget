// @ts-check
import { mount, unmount } from "svelte";
import { createSubscriber } from "svelte/reactivity";

/** @import * as svelte from "svelte" */
/** @import { AnyWidget, AnyModel } from "@anywidget/types" */

/**
 * @template {Record<string, any>} T
 * @param {AnyModel<T>} model
 * @returns T
 */
function createBindings(model) {
	/** @type {Record<string, () => void>} */
	let subscribes = {};
	return new Proxy(/** @type{any} */ ({}), {
		get(_, /** @type {string} */ name) {
			if (!(name in subscribes)) {
				subscribes[name] = createSubscriber((update) => {
					model.on(`change:${name}`, update);
					return () => model.off(`change:${name}`, update);
				});
			}
			subscribes[name]();
			return model.get(name);
		},
		set(_, /** @type {string} */ name, /** @type {any} */ newValue) {
			model.set(name, newValue);
			model.save_changes();
			return true;
		},
	});
}

/**
 * Wraps a Svelte component as an anywidget with reactive model bindings.
 *
 * Sets up two-way binding between the model and Svelte's reactivity.
 *
 * @example
 * ```ts
 * import { defineWidget } from "@anywidget/svelte";
 * import Widget from "./Widget.svelte";
 *
 * export default defineWidget(Widget);
 * ```
 *
 * @template {Record<string, any>} T
 * @param {svelte.Component<{ model?: AnyModel<T>, bindings?: T }>} Widget
 * @returns {AnyWidget<T>}
 */
export function defineWidget(Widget) {
	return () => {
		/** @type {T | undefined} */
		let bindings;
		return {
			initialize({ model }) {
				bindings = createBindings(model);
			},
			/** @type {import("@anywidget/types").Render<T>} */
			render({ model, el }) {
				let app = mount(Widget, {
					target: el,
					props: { model, bindings },
				});
				return () => unmount(app);
			},
		};
	};
}
