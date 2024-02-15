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
