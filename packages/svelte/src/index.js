import { getContext, onDestroy } from "svelte";
import { writable } from "svelte/store";

import { MODEL_SYMBOL, STORES_SYMBOL } from "./constants.js";
import WrapperComponent from "./WrapperComponent.svelte";

/**
 * @template Model
 * @typedef {{ [Key in keyof Model]: import("svelte/store").Writable<Model[Key]> }} Stores
 */

/**
 * @template T
 *
 * @param {string} key
 * @returns {import("svelte/store").Writable<T>}
 */
function anywriteable(key) {
	let model = getContext(MODEL_SYMBOL);
	let { subscribe, set } = writable(model.get(key));
	let update = () => set(model.get(key));
	model.on(`change:${key}`, update);
	onDestroy(() => model.off(`change:${key}`, update));
	return {
		subscribe,
		set(value) {
			model.set(key, value);
			model.save_changes();
		},
		update(updater) {
			model.set(key, updater(model.get(key)));
			model.save_changes();
		},
	};
}

/** @type {import("@anywidget/types").AnyModel} */
export let model = new Proxy(/** @type {any} */ ({}), {
	get(_, key) {
		return getContext(MODEL_SYMBOL)[key];
	},
});

/** @type {Stores<Record<string, any>>} */
export let stores = new Proxy(
	{},
	{
		get(_, key) {
			let cache = getContext(STORES_SYMBOL);
			if (cache[key] === undefined) {
				cache[key] = anywriteable(/** @type {string} */ (key));
			}
			return cache[key];
		},
	},
);

/**
 * @param {import("svelte").ComponentType} Widget
 * @returns {import("@anywidget/types").Render}
 */
export function createRender(Widget) {
	return ({ model, el }) => {
		let widget = new WrapperComponent({
			target: el,
			props: { model, Component: Widget },
		});
		return () => widget.$destroy();
	};
}
