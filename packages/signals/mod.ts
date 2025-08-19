/**
 * @module
 *
 * This module contains an anywidget bridge to define widgets using signals.
 *
 * @example
 * ```ts
 * import { effect, signal } from "@preact/signals-core";
 * import { defineWidget } from "@anywidget/signals";
 *
 * export default defineWidget(signal, {
 *   render({ model, el }) {
 *     let btn = document.createElement("button");
 *     btn.addEventListener("click", () => model.value += 1);
 *     effect(() => {
 *       btn.innerText = `Count is ${model.value}`;
 *     });
 *     el.appendChild(btn);
 *   },
 * });
 * ```
 */

import type * as aw from "@anywidget/types";

/**
 * Represents a abstract signal that internally manages reactive data dependencies.
 * @see {@link https://github.com/tc39/proposal-signals}
 */
interface Signal<T> {
	get(): T;
	set(value: T): void;
}

/**
 * A callback for when a message is received
 * @param event The message event
 * @param data The data of the message
 */
type CustomMessageListener = {
	(event: MessageEvent<[data: unknown, buffers: Array<Uint8Array>]>): void;
};

/** The interface for a host platform connection */
export interface HostPlatform {
	/** Send a message to the host platform */
	postMessage(msg: unknown, buffers?: Array<Uint8Array>): void;
	/** Add a listener for custom messages from the host */
	addEventListener(type: "message", listener: CustomMessageListener): void;
	/** Remove a listener for custom messages from the host */
	removeEventListener(type: "message", listener: CustomMessageListener): void;
}

/**
 * Represents a widget model that has signals for each attribute,
 * and a host platform connection.
 *
 * @template T The data types for the model
 */
export type SignalModel<T extends Record<string, unknown>> = {
	[Key in Exclude<keyof T & string, "host">]: T[Key];
} & {
	host: HostPlatform;
};

/** Connects a Jupyter Widget model as a host platform */
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

/**
 * Create a signal model from a model and a signal function
 * @param signal The function to create a TC39-like signal
 * @param model The anywidget model to connect to
 */
function create<T extends Record<string, unknown>>(
	signal: <T>(value: T) => Signal<T>,
	model: aw.AnyModel<T>,
): SignalModel<T> {
	// TODO: This could be a lot more simple if we infer all the attributes from the model
	// Instead we dynamically create signals when the are first accessed
	let signalModel: SignalModel<T> = {} as SignalModel<T>;
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

type AnySignal = <T>(value: T) => Signal<T>;
type PreactLikeSignal = <T>(value: T) => { value: T };
type SolidLikeSignal = <T>(value: T) => [() => T, (value: T) => void];

function isPreactLikeSignal(
	signal: AnySignal | PreactLikeSignal | SolidLikeSignal,
): signal is <T>(value: T) => { value: T } {
	let test = signal(undefined);
	return "value" in test;
}

function isSolidLikeSignal(
	signal: AnySignal | PreactLikeSignal | SolidLikeSignal,
): signal is <T>(value: T) => [() => T, (value: T) => void] {
	let test = signal(undefined);
	return (
		Array.isArray(test) &&
		test.length === 2 &&
		typeof test[0] === "function" &&
		typeof test[1] === "function"
	);
}

function resolve(
	fn: AnySignal | PreactLikeSignal | SolidLikeSignal,
): AnySignal {
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

type WidgetDef<T extends Record<string, unknown>> = {
	initialize?: (ctx: { model: SignalModel<T> }) => ReturnType<aw.Initialize<T>>;
	render?: (ctx: {
		model: SignalModel<T>;
		el: HTMLElement;
	}) => ReturnType<aw.Render<T>>;
};

/**
 * Define a widget that uses signals to manage state.
 *
 * @param signal The signal function to create a Signal for a piece of model state
 * @param definition The widget definition
 * @returns An AFM-compatible widget
 *
 * @example
 * ```ts
 * import { effect, signal } from "@preact/signals-core";
 * import { defineWidget } from "@anywidget/signals";
 *
 * export default defineWidget(signal, {
 *   render({ model, el }) {
 *     let btn = document.createElement("button");
 *     btn.addEventListener("click", () => model.value += 1);
 *     effect(() => {
 *       btn.innerText = `Count is ${model.value}`;
 *     });
 *     el.appendChild(btn);
 *   },
 * });
 * ```
 */
export function defineWidget<T extends Record<string, unknown>>(
	signal: AnySignal | PreactLikeSignal | SolidLikeSignal,
	definition: WidgetDef<T>,
): aw.AnyWidget<T> {
	signal = resolve(signal);
	return {
		initialize({ model }) {
			return definition.initialize?.({ model: create(signal, model) });
		},
		render({ model, el }) {
			return definition.render?.({ model: create(signal, model), el });
		},
	};
}
