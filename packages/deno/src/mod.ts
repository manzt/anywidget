import * as path from "@std/path";
import { find_data_dir } from "./jupyter_paths.ts";

/**
 * Jupyter widgets for the Deno Jupyter kernel.
 * @module
 */

let COMMS = new WeakMap<object, Comm>();
// TODO: We need to get this version from somewhere. Needs to match packages/anywidget/package.json#version
let DEFAULT_VERSION: string = "0.9.3";
let DEFAULT_ANYWIDGET_VERSION: string = await find_anywidget_version().catch(
	(err) => {
		console.warn(`Failed to find anywidget frontend version: ${err}`);
		return DEFAULT_VERSION;
	},
);

async function find_anywidget_version(): Promise<string> {
	let data_dir = await find_data_dir();
	let contents = await Deno.readTextFile(
		path.resolve(data_dir, "labextensions/anywidget/package.json"),
	);
	return JSON.parse(contents).version;
}

let jupyter_broadcast: Broadcast = (() => {
	try {
		return Deno.jupyter.broadcast;
	} catch (_) {
		return async () => {};
	}
})();

let init_promise_symbol = Symbol("init_promise");

type Broadcast = (
	type: string,
	content: Record<string, unknown>,
	extra?: {
		metadata?: Record<string, unknown>;
	},
) => Promise<void>;

/** The Jupyter "mimebundle" for displaying the underlying widget. */
type Mimebundle = {
	"application/vnd.jupyter.widget-view+json": {
		version_major: number;
		version_minor: number;
		model_id: string;
	};
};

/**
 * @private
 *
 * These are internals used for testing/inspecting anywidget in Deno. DO NOT USE IN PRODUCTION.
 */
interface TestingInternals {
	/** Broadcast a message to the front end. Stubbed in testing. */
	jupyter_broadcast: Broadcast;
	/** Get the comm for a model */
	get_comm(model: object): Comm;
	/** Get the init promise for a model */
	get_init_promise(model: _Model<unknown>): Promise<void> | undefined;
	/** The version of anywidget used. */
	version: string;
}

/** @private */
export const _internals: TestingInternals = {
	jupyter_broadcast,
	get_comm(model: object): Comm {
		let comm = COMMS.get(model);
		if (!comm) {
			throw new Error("No comm found for model");
		}
		return comm;
	},
	get_init_promise(model: _Model<unknown>): Promise<void> | undefined {
		// @ts-expect-error - we hide the symbol from the user
		return model[init_promise_symbol];
	},
	get version() {
		return DEFAULT_ANYWIDGET_VERSION;
	},
};

class Comm {
	#id: string;
	#anywidget_version: string;
	#protocol_version_major: number;
	#protocol_version_minor: number;

	constructor({ anywidget_version }: { anywidget_version?: string }) {
		this.#id = crypto.randomUUID();
		this.#anywidget_version = anywidget_version ?? DEFAULT_ANYWIDGET_VERSION;
		this.#protocol_version_major = 2;
		this.#protocol_version_minor = 1;
	}

	get id(): string {
		return this.#id;
	}

	init(): Promise<void> {
		return _internals.jupyter_broadcast(
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

	send_state(state: object): Promise<void> {
		return _internals.jupyter_broadcast("comm_msg", {
			comm_id: this.id,
			data: { method: "update", state },
		});
	}

	mimebundle(): Mimebundle {
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

class _Model<State> {
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
		this._state[key] = value;
		this._target.dispatchEvent(
			new CustomEvent(`change:${key as string}`, { detail: value }),
		);
	}
	on<Event extends keyof ChangeEvents<State>>(
		name: Event,
		callback: () => void,
	): void {
		this._target.addEventListener(name, callback);
	}
}

export type Model = typeof _Model;

export type FrontEndModel<State> = _Model<State> & {
	save_changes(): void;
};

// Requires mod user to include lib DOM in their compiler options if they want to use this type.
type HTMLElement = typeof globalThis extends { HTMLElement: infer T } ? T
	: unknown;

export type WidgetProps<State> = {
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
	return `${imports}\nexport default { render: ${render.toString()} }`;
}

/**
 * Creates an anywidget for the Deno Jupyter kernel.
 *
 * ```ts
 * import { widget } from "jsr:@anywidget/deno";
 *
 * let counter = widget({
 *   state: { value: 0 },
 *   render: ({ model, el }) => {
 *     let button = document.createElement("button");
 *     button.innerHTML = `count is ${model.get("value")}`;
 *     button.addEventListener("click", () => {
 *       model.set("value", model.get("value") + 1);
 *       model.save_changes();
 *     });
 *     model.on("change:value", () => {
 *       button.innerHTML = `count is ${model.get("value")}`;
 *     });
 *     el.appendChild(button);
 *   }
 * });
 * counter.value = 10;
 * counter; // displays the widget
 * ```
 *
 * @param props - The properties of the widget.
 * @param props.state - The initial state of the widget (must be an object)
 * @param props.render - A function that renders the widget in the front end. This function is serialized and sent to the front end.
 * @param props.imports - The CDN ESM imports required for the front-end function.
 * @param props.version - The version of anywidget to use.
 */
export function widget<State>(props: WidgetProps<State>): _Model<State> {
	let { state, render, imports, version } = props;
	let comm = new Comm({ anywidget_version: version });
	let init_promise = comm
		.init()
		.then(() =>
			comm.send_state({ ...state, _esm: to_esm({ imports, render }) })
		);
	let model = new _Model(state);
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
