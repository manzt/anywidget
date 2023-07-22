// @ts-check
import { onDestroy } from "svelte";
import { writable } from "svelte/store";

/** @type {import("@anywidget/types").AnyModel} */
let model;

/** @returns {import("@anywidget/types").AnyModel}*/
export function getModel() {
	if (!model) throw new Error("No model");
	return model;
}

/** @type {Record<string, import("svelte/store").Writable<any>>} key */
let cache = {};
export let stores = new Proxy(/** @type {any} */ ({}), {
	get(_, key) {
		if (typeof key !== "string") return;
		if (!cache[key]) cache[key] = anywriteable(key);
		return cache[key];
	},
});

/**
 * @template T
 *
 * @param {string} key
 * @returns {import("svelte/store").Writable<T>}
 */
export function anywriteable(key) {
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

/**
 * @param {import("svelte").ComponentType} Widget
 * @returns {import("@anywidget/types").Render}
 */
export function createRender(Widget) {
	return (ctx) => {
		model = ctx.model;
		const widget = new Widget({ target: ctx.el });
		return () => widget.$destroy();
	};
}
