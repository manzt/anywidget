import type * as aw from "@anywidget/types";

// https://github.com/tc39/proposal-signals
interface Signal<T> {
	get(): T;
	set(value: T): void;
}

type CustomMessageListener = {
	(event: MessageEvent<[data: unknown, buffers: Array<Uint8Array>]>): void;
};

interface HostPlatform {
	postMessage(msg: unknown, buffers?: Array<Uint8Array>): void;
	addEventListener(type: "message", listener: CustomMessageListener): void;
	removeEventListener(type: "message", listener: CustomMessageListener): void;
}

type SignalModel<T extends Record<string, unknown>> = {
	[Key in Exclude<keyof T & string, "host">]: T[Key];
} & {
	host: HostPlatform;
};

class JupyterWidgetHostPlatform extends EventTarget {
	#model: aw.AnyModel;
	constructor(model: aw.AnyModel) {
		super();
		this.#model = model;
		model.on("msg:custom", this.#dispatch.bind(this));
	}
	#dispatch(msg: unknown, buffers?: Array<Uint8Array>) {
		this.dispatchEvent(new MessageEvent("message", { data: [msg, buffers] }));
	}
	postMessage(msg: unknown, buffers?: Array<Uint8Array>) {
		this.#model.send(msg, {}, buffers);
	}
}

function create<T extends Record<string, unknown>>(
	signal: <T>(value: T) => Signal<T>,
	model: aw.AnyModel<T>,
): SignalModel<T> {
	// TODO: This could be a lot more simple if we infer all the attributes from the model
	// Instead we dynamically create signals when the are first accessed
	// deno-lint-ignore no-explicit-any
	let signalModel: SignalModel<T> = {} as any;
	Object.defineProperty(signalModel, "host", {
		value: new JupyterWidgetHostPlatform(model),
		writable: false,
		enumerable: false,
		configurable: false,
	});
	// @ts-expect-error - We are dynamically creating signals
	let cache: Record<keyof T, Signal<unknown>> = {};
	function signalFor<K extends keyof T>(key: K): Signal<T[K]> {
		if (!(key in cache)) {
			cache[key] = signal(model.get(key));
		}
		// @ts-expect-error - We have the right type
		return cache[key];
	}
	return new Proxy(signalModel, {
		get(target, key, receiver) {
			if (typeof key === "string" && key !== "host") {
				return signalFor(key).get();
			}
			return Reflect.get(target, key, receiver);
		},
		set(target, key, value, receiver) {
			if (typeof key === "string" && key !== "host") {
				signalFor(key).set(value);
				return true;
			}
			return Reflect.set(target, key, value, receiver);
		},
	});
}

type CreateSignalFunction =
	| (<T>(value: T) => Signal<T>)
	| (<T>(value: T) => { value: T })
	| (<T>(value: T) => [() => T, (value: T) => void]);

function isPreactLikeSignal(
	signal: CreateSignalFunction,
): signal is <T>(value: T) => { value: T } {
	let test = signal(undefined);
	return "value" in test;
}

function isSolidLikeSignal(
	signal: CreateSignalFunction,
): signal is <T>(value: T) => [() => T, (value: T) => void] {
	let test = signal(undefined);
	return (
		Array.isArray(test) &&
		test.length === 2 &&
		typeof test[0] === "function" &&
		typeof test[1] === "function"
	);
}

function resolve(fn: CreateSignalFunction): <T>(value: T) => Signal<T> {
	if (isPreactLikeSignal(fn)) {
		return <T>(initial: T) => {
			let signal = fn(initial);
			return {
				get: () => signal.value,
				set: (value: T) => {
					signal.value = value;
				},
			};
		};
	}
	if (isSolidLikeSignal(fn)) {
		return <T>(initial: T) => {
			let [value, setValue] = fn(initial);
			return {
				get: () => value(),
				set: (v: T) => setValue(v),
			};
		};
	}
	return fn;
}

export default function signalify<T extends Record<string, unknown>>(
	signal: CreateSignalFunction,
	def: {
		initialize(ctx: { model: SignalModel<T> }): void;
		render(ctx: { model: SignalModel<T>; el: HTMLElement }): void;
	},
): aw.AnyWidget<T> {
	signal = resolve(signal);
	return {
		initialize({ model }) {
			return def.initialize?.({ model: create(signal, model) });
		},
		render({ model, el }) {
			return def.render?.({ model: create(signal, model), el });
		},
	};
}
