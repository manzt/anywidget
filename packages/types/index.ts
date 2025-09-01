type Awaitable<T> = T | Promise<T>;
// biome-ignore lint/suspicious/noExplicitAny: Could relax if we wanted default behavior to be looser
type ObjectHash = Record<string, any>;
type ChangeEventHandler<Payload> = (_: unknown, value: Payload) => void;
// biome-ignore lint/suspicious/noExplicitAny: Generic for flexible implementation
type EventHandler = (...args: any[]) => void;
/**
 * Autocomplete works for literal string unions, but adding a union
 * of `string` negates autocomplete entirely. This is a workaround
 * to provide autocomplete but still allow any string.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729
 */
type LiteralUnion<T, U = string> = T | (U & {});

interface WidgetManager {
	/**
	 * Get a promise for a model by model id.
	 */
	get_model<T extends ObjectHash>(model_id: string): Promise<AnyModel<T>>;
}

export interface AnyModel<T extends ObjectHash = ObjectHash> {
	get<K extends keyof T>(key: K): T[K];
	set<K extends keyof T>(key: K, value: T[K]): void;
	off<K extends keyof T>(
		eventName?: LiteralUnion<`change:${K & string}` | "msg:custom"> | null,
		callback?: EventHandler | null,
	): void;
	on(
		eventName: "msg:custom",
		// biome-ignore lint/suspicious/noExplicitAny: could make default more strict with `unknown` but would be breaking
		callback: (msg: any, buffers: DataView[]) => void,
	): void;
	on<K extends `change:${keyof T & string}`>(
		eventName: K,
		callback: K extends `change:${infer Key}`
			? ChangeEventHandler<T[Key]>
			: never,
	): void;
	on<K extends `change:${string}`>(
		eventName: K,
		// biome-ignore lint/suspicious/noExplicitAny: could make default more strict with `unknown` but would be breaking
		callback: ChangeEventHandler<any>,
	): void;
	on(eventName: string, callback: EventHandler): void;
	save_changes(): void;
	send(
		// biome-ignore lint/suspicious/noExplicitAny: could make default more strict with `unknown` but would be breaking
		content: any,
		// biome-ignore lint/suspicious/noExplicitAny: could make default more strict with `unknown` but would be breaking
		callbacks?: any,
		buffers?: ArrayBuffer[] | ArrayBufferView[],
	): void;
	widget_manager: WidgetManager;
}

export type Experimental = {
	invoke: <T>(
		name: string,
		// biome-ignore lint/suspicious/noExplicitAny: could make default more strict with `unknown` but would be breaking
		msg?: any,
		options?: {
			buffers?: DataView[];
			signal?: AbortSignal;
		},
	) => Promise<[T, DataView[]]>;
};

export interface RenderProps<T extends ObjectHash = ObjectHash> {
	model: AnyModel<T>;
	el: HTMLElement;
	experimental: Experimental;
}

export interface Render<T extends ObjectHash = ObjectHash> {
	(props: RenderProps<T>): Awaitable<void | (() => Awaitable<void>)>;
}

export interface InitializeProps<T extends ObjectHash = ObjectHash> {
	model: AnyModel<T>;
	experimental: Experimental;
}

export interface Initialize<T extends ObjectHash = ObjectHash> {
	(props: InitializeProps<T>): Awaitable<void | (() => Awaitable<void>)>;
}

interface WidgetDef<T extends ObjectHash = ObjectHash> {
	initialize?: Initialize<T>;
	render?: Render<T>;
}

export type AnyWidget<T extends ObjectHash = ObjectHash> =
	| WidgetDef<T>
	| (() => Awaitable<WidgetDef<T>>);
