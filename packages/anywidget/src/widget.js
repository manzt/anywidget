import * as solid from "solid-js";
import { Model } from "./model.js";
import { View } from "./view.js";

/**
 * @typedef AnyWidget
 * @prop initialize {import("@anywidget/types").Initialize}
 * @prop render {import("@anywidget/types").Render}
 */

/**
 *  @typedef AnyWidgetModule
 *  @prop render {import("@anywidget/types").Render=}
 *  @prop default {AnyWidget | (() => AnyWidget | Promise<AnyWidget>)=}
 */

/**
 * @param {any} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
	if (!condition) throw new Error(message);
}

/**
 * @param {string} str
 * @returns {str is "https://${string}" | "http://${string}"}
 */
function is_href(str) {
	return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * @param {string} href
 * @param {string} anywidget_id
 * @returns {Promise<void>}
 */
async function load_css_href(href, anywidget_id) {
	/** @type {HTMLLinkElement | null} */
	let prev = document.querySelector(`link[id='${anywidget_id}']`);

	// Adapted from https://github.com/vitejs/vite/blob/d59e1acc2efc0307488364e9f2fad528ec57f204/packages/vite/src/client/client.ts#L185-L201
	// Swaps out old styles with new, but avoids flash of unstyled content.
	// No need to await the load since we already have styles applied.
	if (prev) {
		let newLink = /** @type {HTMLLinkElement} */ (prev.cloneNode());
		newLink.href = href;
		newLink.addEventListener("load", () => prev?.remove());
		newLink.addEventListener("error", () => prev?.remove());
		prev.after(newLink);
		return;
	}

	return new Promise((resolve) => {
		let link = Object.assign(document.createElement("link"), {
			rel: "stylesheet",
			href,
			onload: resolve,
		});
		document.head.appendChild(link);
	});
}

/**
 * @param {string} css_text
 * @param {string} anywidget_id
 * @returns {void}
 */
function load_css_text(css_text, anywidget_id) {
	/** @type {HTMLStyleElement | null} */
	let prev = document.querySelector(`style[id='${anywidget_id}']`);
	if (prev) {
		// replace instead of creating a new DOM node
		prev.textContent = css_text;
		return;
	}
	let style = Object.assign(document.createElement("style"), {
		id: anywidget_id,
		type: "text/css",
	});
	style.appendChild(document.createTextNode(css_text));
	document.head.appendChild(style);
}

/**
 * @param {string | undefined} css
 * @param {string} anywidget_id
 * @returns {Promise<void>}
 */
async function load_css(css, anywidget_id) {
	if (!css || !anywidget_id) return;
	if (is_href(css)) return load_css_href(css, anywidget_id);
	return load_css_text(css, anywidget_id);
}

/**
 * @param {string} esm
 * @returns {Promise<{ mod: AnyWidgetModule, url: string }>}
 */
async function load_esm(esm) {
	if (is_href(esm)) {
		return {
			mod: await import(/* webpackIgnore: true */ esm),
			url: esm,
		};
	}
	let url = URL.createObjectURL(new Blob([esm], { type: "text/javascript" }));
	let mod = await import(/* webpackIgnore: true */ url);
	URL.revokeObjectURL(url);
	return { mod, url };
}

function warn_render_deprecation() {
	console.warn(`\
[anywidget] Deprecation Warning. Direct export of a 'render' will likely be deprecated in the future. To migrate ...

Remove the 'export' keyword from 'render'
-----------------------------------------

export function render({ model, el }) { ... }
^^^^^^

Create a default export that returns an object with 'render'
------------------------------------------------------------

function render({ model, el }) { ... }
         ^^^^^^
export default { render }
                 ^^^^^^

To learn more, please see: https://github.com/manzt/anywidget/pull/395
`);
}

/**
 * @param {string} esm
 * @returns {Promise<AnyWidget & { url: string }>}
 */
async function load_widget(esm) {
	let { mod, url } = await load_esm(esm);
	if (mod.render) {
		warn_render_deprecation();
		return {
			url,
			async initialize() { },
			render: mod.render,
		};
	}
	assert(
		mod.default,
		`[anywidget] module must export a default function or object.`,
	);
	let widget = typeof mod.default === "function"
		? await mod.default()
		: mod.default;
	return { url, ...widget };
}

/**
 * This is a trick so that we can cleanup event listeners added
 * by the user-defined function.
 */
let INITIALIZE_MARKER = Symbol("anywidget.initialize");

/**
 * @template {Record<string, any>} T
 *
 * @param {Model<T>} model
 * @param {unknown} context
 * @return {import("@anywidget/types").AnyModel}
 *
 * Prunes the view down to the minimum context necessary.
 *
 * Calls to `model.get` and `model.set` automatically add the
 * `context`, so we can gracefully unsubscribe from events
 * added by user-defined hooks.
 */
function model_proxy(model, context) {
	return {
		get: model.get.bind(model),
		set: model.set.bind(model),
		save_changes: model.save_changes.bind(model),
		send: model.send.bind(model),
		// @ts-expect-error
		on(name, callback) {
			model.on(name, callback);
		},
		off(name, callback) {
			model.off(name, callback);
		},
		widget_manager: model.widget_manager,
	};
}

/**
 * @param {void | (() => import('vitest').Awaitable<void>)} fn
 * @param {string} kind
 */
async function safe_cleanup(fn, kind) {
	return Promise.resolve()
		.then(() => fn?.())
		.catch((e) => console.warn(`[anywidget] error cleaning up ${kind}.`, e));
}

/**
 * @template T
 * @typedef {{ data: T, state: "ok" } | { error: any, state: "error" }} Result
 */

/** @type {<T>(data: T) => Result<T>} */
function ok(data) {
	return { data, state: "ok" };
}

/** @type {(e: any) => Result<any>} */
function error(e) {
	return { error: e, state: "error" };
}

/**
 * Cleans up the stack trace at anywidget boundary.
 * You can fully inspect the entire stack trace in the console interactively,
 * but the initial error message is cleaned up to be more user-friendly.
 *
 * @param {unknown} source
 * @returns {never}
 */
function throw_anywidget_error(source) {
	if (!(source instanceof Error)) {
		// Don't know what to do with this.
		throw source;
	}
	let lines = source.stack?.split("\n") ?? [];
	let anywidget_index = lines.findIndex((line) => line.includes("anywidget"));
	let clean_stack = anywidget_index === -1
		? lines
		: lines.slice(0, anywidget_index + 1);
	source.stack = clean_stack.join("\n");
	console.error(source);
	throw source;
}

/** @param {HTMLElement} el */
function empty_element(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

class Runtime {
	/** @type {() => void} */
	#disposer = () => { };
	/** @type {Set<() => void>} */
	#view_disposers = new Set();
	/** @type {import('solid-js').Resource<Result<AnyWidget & { url: string }>>} */
	// @ts-expect-error - Set synchronously in constructor.
	#widget_result;

	/** @param {Model<{ _esm: string, _css?: string, _anywidget_id: string }>} model */
	constructor(model) {
		this.#disposer = solid.createRoot((dispose) => {
			let [css, set_css] = solid.createSignal(model.get("_css"));
			model.on("change:_css", () => {
				let id = model.get("_anywidget_id");
				console.debug(`[anywidget] css hot updated: ${id}`);
				set_css(model.get("_css"));
			});
			solid.createEffect(() => {
				let id = model.get("_anywidget_id");
				load_css(css(), id);
			});

			/** @type {import("solid-js").Signal<string>} */
			let [esm, setEsm] = solid.createSignal(model.get("_esm"));
			model.on("change:_esm", async () => {
				let id = model.get("_anywidget_id");
				console.debug(`[anywidget] esm hot updated: ${id}`);
				setEsm(model.get("_esm"));
			});
			/** @type {void | (() => import("vitest").Awaitable<void>)} */
			let cleanup;
			this.#widget_result = solid.createResource(esm, async (update) => {
				await safe_cleanup(cleanup, "initialize");
				try {
					await model.state_change;
					let widget = await load_widget(update);
					cleanup = await widget.initialize?.({ model });
					return ok(widget);
				} catch (e) {
					return error(e);
				}
			})[0];
			return () => {
				cleanup?.();
				model.off("change:_css");
				model.off("change:_esm");
				dispose();
			};
		});
	}

	/**
	 * @param {View<any>} view
	 * @returns {Promise<() => void>}
	 */
	async create_view(view) {
		let model = view.model;
		let disposer = solid.createRoot((dispose) => {
			/** @type {void | (() => import("vitest").Awaitable<void>)} */
			let cleanup;
			let resource =
				solid.createResource(this.#widget_result, async (widget_result) => {
					cleanup?.();
					// Clear all previous event listeners from this hook.
					// model.off(null, null, view);
					empty_element(view.el);
					if (widget_result.state === "error") {
						throw_anywidget_error(widget_result.error);
					}
					let widget = widget_result.data;
					try {
						cleanup = await widget.render?.({
							model: model_proxy(model, view),
							el: view.el,
						});
					} catch (e) {
						throw_anywidget_error(e);
					}
				})[0];
			solid.createEffect(() => {
				if (resource.error) {
					// TODO: Show error in the view?
				}
			});
			return () => {
				dispose();
				cleanup?.();
			};
		});
		// Have the runtime keep track but allow the view to dispose itself.
		this.#view_disposers.add(disposer);
		return () => {
			let deleted = this.#view_disposers.delete(disposer);
			if (deleted) disposer();
		};
	}

	dispose() {
		this.#view_disposers.forEach((dispose) => dispose());
		this.#view_disposers.clear();
		this.#disposer();
	}
}

// @ts-expect-error - injected by bundler
let version = globalThis.VERSION;

export default function() {
	/** @type {WeakMap<AnyModel<any>, Runtime>} */
	let RUNTIMES = new WeakMap();

	/**
	 * @template {{ _esm: string, _css?: string, _anywidget_id: string }} T
	 * @extends {Model<T>}
	 */
	class AnyModel extends Model {
		/** @param {ConstructorParameters<typeof Model<T>>} args */
		constructor(...args) {
			super(...args);
			let runtime = new Runtime(this);
			this.once("destroy", () => {
				try {
					runtime.dispose();
				} finally {
					RUNTIMES.delete(this);
				}
			});
			RUNTIMES.set(this, runtime);
		}
	}

	/** @extends {View<any>} */
	class AnyView extends View {
		/** @type {undefined | (() => void)} */
		#dispose = undefined;
		async render() {
			let runtime = RUNTIMES.get(/** @type {any} */(this.model));
			assert(runtime, "[anywidget] runtime not found.");
			assert(!this.#dispose, "[anywidget] dispose already set.");
			this.#dispose = await runtime.create_view(this);
		}
		remove() {
			this.#dispose?.();
			super.remove();
		}
	}

	return { AnyModel, AnyView };
}
