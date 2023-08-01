// @ts-check
import { onDestroy } from "svelte";
import { writable } from "svelte/store";

let model_marker = Symbol("anywidget.model");

/**
 * @template Model
 * @typedef {{ [Key in keyof Model]: import("svelte/store").Writable<Model[Key]> }} Stores
 */

/** @type {import("@anywidget/types").AnyModel} */
export let model = new Proxy(/** @type {any} */ ({}), {
	get(target, key) {
		try {
			return target[model_marker][key];
		} catch (e) {
			if (e instanceof TypeError) {
				throw new Error(
					"Model not set. Did you forget to call `createRender`?",
				);
			}
			throw e;
		}
	},
	set(target, key, value) {
		if (key !== model_marker) {
			throw new Error("Model is read-only");
		}
		target[model_marker] = value;
		return true;
	},
});

/** @type {Record<string, import("svelte/store").Writable<any>>} key */
let cache = {};

export const stores = new Proxy(/** @type {Stores<any>} */ ({}), {
	get(_, key) {
		// @ts-expect-error
		if (cache[key]) return cache[key];
		// @ts-expect-error
		return (cache[key] = anywriteable(key));
	},
});

/**
 * @template T
 *
 * @param {string} key
 * @returns {import("svelte/store").Writable<T>}
 */
function anywriteable(key) {
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
		// @ts-expect-error
		model[model_marker] = ctx.model;
		const widget = new Widget({ target: ctx.el });
		return () => widget.$destroy();
	};
}
