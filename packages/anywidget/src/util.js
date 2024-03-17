/**
 * @param {unknown} obj
 * @returns {boolean}
 */
export function is_object(obj) {
	return typeof obj === "object" && obj !== null;
}

/**
 * @param {unknown} condition
 * @param {string} msg
 * @returns {asserts condition}
 */
export function assert(condition, msg) {
	if (!condition) {
		throw new Error(msg);
	}
}

/**
 * Takes an object 'state' and fills in buffer[i] at 'path' buffer_paths[i]
 * where buffer_paths[i] is a list indicating where in the object buffer[i] should
 * be placed
 * Example: state = {a: 1, b: {}, c: [0, null]}
 * buffers = [array1, array2]
 * buffer_paths = [['b', 'data'], ['c', 1]]
 * Will lead to {a: 1, b: {data: array1}, c: [0, array2]}
 *
 * @param {Record<string, unknown>} state
 * @param {ReadonlyArray<ReadonlyArray<string | number>>} buffer_paths
 * @param {ReadonlyArray<ArrayBufferLike | DataView>} buffers
 */
export function put_buffers(state, buffer_paths = [], buffers = []) {
	let data_views = buffers.map((b) => {
		if (b instanceof DataView) return b;
		if (b instanceof ArrayBuffer) return new DataView(b);
		throw new Error("Unknown buffer type: " + b);
	});
	assert(
		buffer_paths.length === data_views.length,
		"Not the same number of buffer_paths and buffers",
	);
	for (let i = 0; i < buffer_paths.length; i++) {
		let buffer = buffers[i];
		let buffer_path = buffer_paths[i];

		// say we want to set state[x][y][z] = buffer
		/** @type {any} */
		let node = state;
		// we first get obj = state[x][y]
		for (let path of buffer_path.slice(0, -1)) {
			node = node[path];
		}
		// and then set: obj[z] = buffer
		node[buffer_path[buffer_path.length - 1]] = buffer;
	}
}

/**
 * @param {Record<string, unknown>} state
 * @returns {{
 *   state: import("./types.js").JSONValue,
 *   buffer_paths: Array<Array<string | number>>,
 *   buffers: Array<ArrayBuffer>
 * }}
 */
export function extract_buffers(state) {
	/** @type {Array<Array<string | number>>} */
	let buffer_paths = [];
	/** @type {Array<ArrayBuffer>} */
	let buffers = [];
	/**
	 * @param {any} obj
	 * @param {any} parent
	 * @param {string | number | null} key_in_parent
	 * @param {Array<string | number>} path
	 */
	function extract_buffers_and_paths(
		obj,
		parent = null,
		key_in_parent = null,
		path = [],
	) {
		if (obj instanceof ArrayBuffer || obj instanceof DataView) {
			buffer_paths.push([...path]);
			buffers.push("buffer" in obj ? obj.buffer : obj);
			if (parent !== null && key_in_parent !== null) {
				// mutate the parent to remove the buffer
				parent[key_in_parent] = null;
			}
			return;
		}
		if (is_object(obj)) {
			for (let [key, value] of Object.entries(obj)) {
				extract_buffers_and_paths(value, obj, key, path.concat(key));
			}
		}
		if (Array.isArray(obj)) {
			for (let i = 0; i < obj.length; i++) {
				extract_buffers_and_paths(obj[i], obj, i, path.concat(i));
			}
		}
	}
	extract_buffers_and_paths(state);
	/** @type {import("./types.js").JSONValue} */
	// @ts-expect-error - TODO: fix type
	let json_state = state;
	return { state: json_state, buffer_paths, buffers };
}

/**
 * @param {import("./types.js").CommMessage} msg
 * @returns {msg is import("./types.js").CustomMessage}
 */
export function is_custom_msg(msg) {
	return msg.content.data.method === "custom";
}

/**
 * @param {import("./types.js").CommMessage} msg
 * @returns {msg is import("./types.js").UpdateMessage | import("./types.js").EchoUpdateMessage}
 */
export function is_update_msg(msg) {
	return msg.content.data.method === "update" ||
		msg.content.data.method === "echo_update";
}

/**
 * @param {import("./types.js").UpdateMessage | import("./types.js").EchoUpdateMessage} msg
 * @return {msg is import("./types.js").EchoUpdateMessage}
 */
export function is_echo_update_msg(msg) {
	return msg.content.data.method === "echo_update" &&
		!!msg.parent_header?.msg_id;
}

/**
 * @param {string} str
 * @returns {str is "https://${string}" | "http://${string}"}
 */
export function is_href(str) {
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
export async function load_css(css, anywidget_id) {
	if (!css || !anywidget_id) return;
	if (is_href(css)) return load_css_href(css, anywidget_id);
	return load_css_text(css, anywidget_id);
}

/**
 * @param {string} esm
 * @returns {Promise<{ mod: import("./types.js").AnyWidgetModule, url: string }>}
 */
export async function load_esm(esm) {
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
 * @returns {Promise<import("./types.js").AnyWidget & { url: string }>}
 */
export async function load_widget(esm) {
	let { mod, url } = await load_esm(esm);
	if (mod.render) {
		warn_render_deprecation();
		return {
			url,
			async initialize() {},
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
 * @template {Record<string, any>} T
 *
 * @param {import('./model.js').Model<T>} model
 * @param {unknown} context
 * @return {import("@anywidget/types").AnyModel}
 *
 * Prunes the view down to the minimum context necessary.
 *
 * Calls to `model.get` and `model.set` automatically add the
 * `context`, so we can gracefully unsubscribe from events
 * added by user-defined hooks.
 */
export function model_proxy(model, context) {
	return {
		get: model.get.bind(model),
		set: model.set.bind(model),
		save_changes: model.save_changes.bind(model),
		send: model.send.bind(model),
		// @ts-expect-error
		on(name, callback) {
			model.on(name, callback, context);
		},
		off(name, callback) {
			model.off(name, callback, context);
		},
		widget_manager: model.widget_manager,
	};
}

/**
 * @param {void | (() => import('vitest').Awaitable<void>)} fn
 * @param {string} kind
 */
export async function safe_cleanup(fn, kind) {
	return Promise.resolve()
		.then(() => fn?.())
		.catch((e) => console.warn(`[anywidget] error cleaning up ${kind}.`, e));
}

/**
 * @template T
 * @typedef {{ data: T, state: "ok" } | { error: any, state: "error" }} Result
 */

/** @type {<T>(data: T) => Result<T>} */
export function ok(data) {
	return { data, state: "ok" };
}

/** @type {(e: any) => Result<any>} */
export function error(e) {
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
export function throw_anywidget_error(source) {
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
export function empty_element(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}
