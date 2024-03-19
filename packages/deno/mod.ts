import * as path from "jsr:@std/path@0.220.1";
import { find_data_dir } from "./jupyter_paths.ts";

let COMMS = new WeakMap<object, Comm>();
let DEFAULT_VERSION = "0.7.0";
let ANYWIDGET_VERSION = await find_anywidget_version().catch(
	() => DEFAULT_VERSION,
);

async function find_anywidget_version(): Promise<string> {
	let data_dir = await find_data_dir();
	let contents = await Deno.readTextFile(
		path.resolve(data_dir, "labextensions/anywidget/package.json"),
	);
	return JSON.parse(contents).version;
}

type Broadcast = (
	type: string,
	content: Record<string, unknown>,
	extra?: {
		metadata?: Record<string, unknown>;
	},
) => Promise<void>;

let jupyter_broadcast: Broadcast = (() => {
	try {
		return Deno.jupyter.broadcast;
	} catch (_) {
		return async () => {};
	}
})();

let init_promise_symbol = Symbol("init_promise");

export const _internals = {
	jupyter_broadcast,
	get_comm(model: object): Comm {
		let comm = COMMS.get(model);
		if (!comm) {
			throw new Error("No comm found for model");
		}
		return comm;
	},
	get_init_promise(model: object): Promise<void> | undefined {
		// @ts-expect-error - Symbol is not in the type definition
		return model[init_promise_symbol];
	},
};

class Comm {
	#id: string;
	#anywidget_version: string;
	#protocol_version_major: number;
	#protocol_version_minor: number;

	constructor({ anywidget_version }: { anywidget_version?: string }) {
		this.#id = crypto.randomUUID();
		this.#anywidget_version = anywidget_version ?? ANYWIDGET_VERSION;
		this.#protocol_version_major = 2;
		this.#protocol_version_minor = 1;
	}

	get id() {
		return this.#id;
	}

	async init() {
		await _internals.jupyter_broadcast(
			"comm_open",
			{
				comm_id: this.id,
				target_name: "jupyter.widget",
				data: {
					state: {
						_model_module: "anywidget",
						_model_name: "AnyModel",
						_model_module_version: this.#anywidget_version,
						_view_module: "anywidget",
						_view_name: "AnyView",
						_view_module_version: this.#anywidget_version,
						_view_count: null,
					},
				},
			},
			{
				metadata: {
					version:
						`${this.#protocol_version_major}.${this.#protocol_version_minor}.0`,
				},
			},
		);
	}

	async send_state(state: object) {
		await _internals.jupyter_broadcast("comm_msg", {
			comm_id: this.id,
			data: { method: "update", state: state },
		});
	}

	mimebundle() {
		return {
			"application/vnd.jupyter.widget-view+json": {
				version_major: this.#protocol_version_major,
				version_minor: this.#protocol_version_minor,
				model_id: this.id,
			},
		};
	}
}

type ChangeEvents<State> = {
	[K in string & keyof State as `change:${K}`]: State[K];
};

class Model<State> {
	private _state: State;
	private _target: EventTarget;

	constructor(state: State) {
		this._state = state;
		this._target = new EventTarget();
	}
	get<K extends keyof State>(key: K): State[K] {
		return this._state[key];
	}
	set<K extends keyof State>(key: K, value: State[K]): void {
		// @ts-expect-error can't convince TS that K is a key of State
		this._emit(`change:${key}`, value);
		this._state[key] = value;
	}
	on<Event extends keyof ChangeEvents<State>>(
		name: Event,
		callback: () => void,
	): void {
		this._target.addEventListener(name, callback);
	}

	private _emit(name: string, data: unknown) {
		this._target.dispatchEvent(new CustomEvent(name, { detail: data }));
	}
}

type FrontEndModel<State> = Model<State> & {
	save_changes(): void;
};

// Requires mod user to include lib DOM in their compiler options if they want to use this type.
type HTMLElement = typeof globalThis extends { HTMLElement: infer T } ? T
	: unknown;

type WidgetProps<State> = {
	/** The initial state of the widget. */
	state: State;
	/** A function that renders the widget. This function is serialized and sent to the front end. */
	render: (context: {
		model: FrontEndModel<State>;
		el: HTMLElement;
	}) => unknown;
	/** The imports required for the front-end function. */
	imports?: string;
	/** The version of anywidget to use. */
	version?: string;
};

// TODO: more robust serialization of render function (with context?)
function to_esm<State>({
	imports = "",
	render,
}: Pick<WidgetProps<State>, "imports" | "render">) {
	return `${imports}\nexport const render = ${render.toString()}`;
}

export function widget<State>({
	state,
	render,
	imports,
	version,
}: WidgetProps<State>) {
	let model = new Model(state);
	let comm = new Comm({ anywidget_version: version });
	let init_promise = comm
		.init()
		.then(() =>
			comm.send_state({ ...state, _esm: to_esm({ imports, render }) })
		);
	for (let key in state) {
		model.on(`change:${key}`, () => {
			comm.send_state({ [key]: model.get(key) });
		});
	}
	let obj = new Proxy(model, {
		get(target, prop, receiver) {
			if (prop === init_promise_symbol) {
				return init_promise;
			}
			if (prop === Symbol.for("Jupyter.display")) {
				return async () => {
					await init_promise;
					return comm.mimebundle();
				};
			}
			return Reflect.get(target, prop, receiver);
		},
		has(target, prop) {
			if (prop === Symbol.for("Jupyter.display")) {
				return true;
			}
			return Reflect.has(target, prop);
		},
	});
	COMMS.set(obj, comm);
	return obj;
}
