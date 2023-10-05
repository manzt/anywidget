import mitt, { type Emitter } from "npm:mitt@3";

// TODO: Find this automatically from where the jupyter assets are installed?
const ANYWIDGET_VERSION = "0.6.5";

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
		await Deno.jupyter.broadcast(
			"comm_open",
			{
				"comm_id": this.id,
				"target_name": "jupyter.widget",
				"data": {
					"state": {
						"_model_module": "anywidget",
						"_model_name": "AnyModel",
						"_model_module_version": this.#anywidget_version,
						"_view_module": "anywidget",
						"_view_name": "AnyView",
						"_view_module_version": this.#anywidget_version,
						"_view_count": null,
					},
				},
			},
			{
				"metadata": {
					"version":
						`${this.#protocol_version_major}.${this.#protocol_version_minor}.0`,
				},
			},
		);
	}

	async send_state(state: object) {
		await Deno.jupyter.broadcast("comm_msg", {
			"comm_id": this.id,
			"data": { "method": "update", "state": state },
		});
	}

	mimebundle() {
		return {
			"application/vnd.jupyter.widget-view+json": {
				"version_major": this.#protocol_version_major,
				"version_minor": this.#protocol_version_minor,
				"model_id": this.id,
			},
		};
	}
}

type ChangeEvents<State> = {
	[K in (string & keyof State) as `change:${K}`]: State[K];
};

class Model<State> {
	_state: State;
	_emitter: Emitter<ChangeEvents<State>>;

	constructor(state: State) {
		this._state = state;
		// types are messed up for mitt.
		this._emitter = (mitt as unknown as typeof mitt.default)<
			ChangeEvents<State>
		>();
	}
	get<K extends keyof State>(key: K): State[K] {
		return this._state[key];
	}
	set<K extends keyof State>(key: K, value: State[K]): void {
		// @ts-expect-error can't convince TS that K is a key of State
		this._emitter.emit(`change:${key}`, value);
		this._state[key] = value;
	}
	on<Event extends keyof ChangeEvents<State>>(
		name: Event,
		callback: (data: ChangeEvents<State>[Event]) => void,
	): void {
		this._emitter.on(name, callback);
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
	render: (
		context: { model: FrontEndModel<State>; el: HTMLElement },
	) => unknown;
	/** The imports required for the front-end function. */
	imports?: string;
	/** The version of anywidget to use. */
	version?: string;
};

// TODO: more robust serialization of render function (with context?)
function to_esm<State>(
	{ imports, render }: Pick<WidgetProps<State>, "imports" | "render">,
) {
	return `${imports}\nexport const render = ${render.toString()}`;
}

export async function widget<State>(
	{ state, render, imports, version }: WidgetProps<State>,
) {
	let model = new Model(state);
	let comm = new Comm({ anywidget_version: version });
	await comm.init();
	await comm.send_state({ ...state, _esm: to_esm({ imports, render }) });
	for (let key in state) {
		model.on(`change:${key}`, (data) => {
			comm.send_state({ [key]: data });
		});
	}
	return new Proxy(model, {
		get(target, prop, receiver) {
			if (prop === Symbol.for("Jupyter.display")) {
				return comm.mimebundle.bind(comm);
			}
			return Reflect.get(target, prop, receiver);
		},
	});
}
