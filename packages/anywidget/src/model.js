import * as utils from "./util.js";

/** @template {Record<string, unknown>} State */
export class Model {
	/** @type {import("./types.js").Comm=} */
	#comm;
	/** @type {Omit<import("./types.js").ModelOptions, "comm">} */
	#options;
	/** @type {{ [evt_name: string]: Map<() => void, (event: Event) => void> }} */
	#listeners = {};
	/** @type {State} */
	#state;
	/** @type {Set<string>} */
	#need_sync = new Set();
	/** @type {Record<string, import("./types.js").FieldSerializer<any, any>>} */
	#field_serializers;
	/** @type {EventTarget} */
	#events = new EventTarget();


	// NOTE: (from Jupyter Team): keep track of the msg id for each attr for updates
	// we send out so that we can ignore old messages that we send in
	// order to avoid 'drunken' sliders going back and forward
	/** @type {Map<string, string>} */
	#expected_echo_msg_ids = new Map();

	// NOTE: Required for the WidgetManager to know when the model is ready
	/** @type {Promise<void>} */
	state_change;

	/** @type {Record<string, Promise<unknown>>} */
	views = {}

	/**
	 * @param {State} state
	 * @param {import("./types.js").ModelOptions} options
	 */
	constructor(state, options) {
		this.#state = state;
		this.#options = options;
		this.#field_serializers = {
			layout: {
				/** @param {string} layout */
				serialize(layout) {
					return JSON.parse(JSON.stringify(layout));
				},
				/** @param {string} layout */
				deserialize(layout, widget_manager) {
					return widget_manager.get_model(layout.slice("IPY_MODEL_".length));
				},
			},
		};
		this.#comm = options.comm;
		this.#comm?.on_msg(this.#handle_comm_msg.bind(this));
		this.#comm?.on_close(this.#handle_comm_close.bind(this));
		this.state_change = this.#deserialize(state).then((de) => {
			this.#state = de;
		});
	}

	get widget_manager() {
		return this.#options.widget_manager;
	}

	get comm_live() {
		return !!this.#comm;
	}

	get #msg_buffer() {
		return {};
	}

	/**
	 * Deserialize the model state.
	 *
	 * Required by any WidgetManager but we want to decode the initial
	 * state of the model ourselves.
	 *
	 * @template T
	 * @param state {T}
	 * @returns {Promise<T>}
	 */
	static async _deserialize_state(state) {
		return state;
	}

	/**
	 * Serialize the model state.
	 * @template {Partial<State>} T
	 * @param {T} ser
	 * @returns {Promise<T>}
	 */
	async #deserialize(ser) {
		/** @type {any} */
		let state = {};
		for (let key in ser) {
			let serializer = this.#field_serializers[key];
			if (!serializer) {
				state[key] = ser[key];
				continue;
			}
			state[key] = await serializer.deserialize(
				ser[key],
				this.#options.widget_manager,
			);
		}
		return state;
	}

	/**
	 * Deserialize the model state.
	 * @template {Partial<State>} T
	 * @param {T} de
	 * @returns {Promise<T>}
	 */
	async serialize(de) {
		/** @type {any} */
		let state = {};
		for (let key in de) {
			let serializer = this.#field_serializers[key];
			if (!serializer) {
				state[key] = structuredClone(de[key]);
				continue;
			}
			state[key] = await serializer.serialize(de[key]);
		}
		return state;
	}

	/**
	 * Handle when a comm message is received.
	 * @param {import("./types.js").CommMessage} msg - the comm message.
	 */
	async #handle_comm_msg(msg) {
		if (utils.is_update_msg(msg)) {
			return this.#handle_update(msg);
		}
		if (utils.is_custom_msg(msg)) {
			this.#emit("msg:custom", [msg.content.data.content, msg.buffers]);
		}
		throw new Error(`unhandled comm message: ${JSON.stringify(msg)}`);
	}

	/**
	 * @param {import("./types.js").UpdateMessage | import("./types.js").EchoUpdateMessage} msg
	 */
	async #handle_update({ content, buffers, parent_header }) {
		let state = content.data.state;
		utils.put_buffers(state, content.data.buffer_paths, buffers);
		if (content.data.method === "echo_update" && parent_header?.msg_id) {
			this.#resolve_echo(state, parent_header.msg_id);
		}
		// @ts-expect-error - we don't validate this
		let deserialized = await this.#deserialize(state);
		this.set_state(deserialized);
	}

	/**
	 * @param {Record<string, unknown>} state
	 * @param {string} msg_id
	 */
	#resolve_echo(state, msg_id) {
		// we may have echos coming from other clients, we only care about
		// dropping echos for which we expected a reply
		for (let name of Object.keys(state)) {
			if (this.#expected_echo_msg_ids.has(name)) {
				continue;
			}
			let stale = this.#expected_echo_msg_ids.get(name) !== msg_id;
			if (stale) {
				delete state[name];
				continue;
			}
			// we got our echo confirmation, so stop looking for it
			this.#expected_echo_msg_ids.delete(name);
			// Start accepting echo updates unless we plan to send out a new state soon
			if (this.#msg_buffer?.hasOwnProperty(name)) {
				delete state[name];
			}
		}
	}


	/**
	 * @param {string} name
	 * @param {unknown} [value]
	 */
	#emit(name, value) {
		this.#events.dispatchEvent(new CustomEvent(name, { detail: value }));
	}

	/**
	 * Close model
	 *
	 * @param comm_closed - true if the comm is already being closed. If false, the comm will be closed.
	 * @returns - a promise that is fulfilled when all the associated views have been removed.
	 */
	async #handle_comm_close() {
		// can only be closed once.
		if (!this.#comm) return;
		this.#emit("comm:close");
		this.#comm.close();
		for (let [event, map] of Object.entries(this.#listeners)) {
			for (let listener of map.values()) {
				this.#events.removeEventListener(event, listener);
			}
		}
		this.#listeners = {};
		this.#comm = undefined;
		for await (let view of Object.values(this.views)) view.remove();
		this.views.clear();
	}

	/**
	 * @template {keyof State} K
	 * @param {K} key
	 * @returns {State[K]}
	 */
	get(key) {
		return this.#state[key];
	}

	/**
	 * @template {keyof State & string} K
	 * @param {K} key
	 * @param {State[K]} value
	 */
	set(key, value) {
		this.#state[key] = value;
		this.#emit(`change:${key}`);
		this.#emit("change");
		this.#need_sync.add(key);
	}

	async save_changes() {
		if (!this.#comm) return;
		/** @type {Partial<State>} */
		let to_send = {};
		for (let key of this.#need_sync) {
			// @ts-expect-error - we know this is a valid key
			to_send[key] = this.#state[key];
		}
		let serialized = await this.serialize(to_send);
		this.#need_sync.clear();
		let split = utils.extract_buffers(serialized);
		this.#comm.send(
			{
				method: "update",
				state: split.state,
				buffer_paths: split.buffer_paths,
			},
			undefined,
			{},
			split.buffers,
		);
	}

	/**
	 * @overload
	 * @param {string} event
	 * @param {() => void} callback
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {"msg:custom"} event
	 * @param {(content: unknown, buffers: ArrayBuffer[]) => void} callback
	 * @returns {void}
	 */
	/**
	 * @param {string} event
	 * @param {(...args: any[]) => void} callback
	 */
	on(event, callback) {
		/** @type {(event?: unknown) => void} */
		let handler;
		if (event === "msg:custom") {
			// @ts-expect-error - we know this is a valid handler
			handler = (/** @type {CustomEvent} */ event) => callback(...event.detail);
		} else {
			handler = () => callback();
		}
		this.#listeners[event] = this.#listeners[event] ?? new Map();
		this.#listeners[event].set(callback, handler);
		this.#events.addEventListener(event, handler);
	}

	/**
	 * @param {Partial<State>} state
	 */
	set_state(state) {
		for (let key in state) {
			// @ts-expect-error - we know this is a valid key
			this.#state[key] = state[key];
			this.#emit(`change:${key}`);
		}
		this.#emit("change");
	}

	get_state() {
		return this.#state;
	}

	/**
	 * @param {string} event
	 * @param {() => void} [callback]
	 */
	off(event, callback) {
		let listeners = this.#listeners[event];
		if (!listeners) {
			return;
		}
		if (!callback) {
			for (let handler of listeners.values()) {
				this.#events.removeEventListener(event, handler);
			}
			listeners.clear();
			return;
		}
		let handler = listeners.get(callback);
		if (!handler) return;
		this.#events.removeEventListener(event, handler);
		listeners.delete(callback);
	}

	/**
	 * Send a custom msg over the comm.
	 * @param {import("./types.js").JSONValue} content - The content of the message.
	 * @param {unknown} [callbacks] - The callbacks for the message.
	 * @param {ArrayBuffer[]} [buffers] - An array of ArrayBuffers to send as part of the message.
	 */
	send(content, callbacks, buffers) {
		if (!this.#comm) return;
		this.#comm.send({ method: "custom", content }, callbacks, {}, buffers);
	}

	/** @param {string} event */
	trigger(event) {
		utils.assert(event === "destroy", "Only 'destroy' event is supported");
		this.#emit(event);
	}

	/**
	 * @param {string} event
	 * @param {() => void} callback
	 */
	once(event, callback) {
		let handler = () => {
			callback();
			this.off(event, handler);
		};
		this.on(event, handler);
	}
}
