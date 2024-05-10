import type { IWidgetManager } from "@jupyter-widgets/base";

type Awaitable<T> = T | Promise<T>;
type ObjectHash = Record<string, any>;
type ChangeEventHandler<Payload> = (_: unknown, value: Payload) => void;
type EventHandler = (...args: any[]) => void;
/**
 * Autocomplete works for literal string unions, but adding a union
 * of `string` negates autocomplete entirely. This is a workaround
 * to provide autocomplete but still allow any string.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729
 */
type LiteralUnion<T, U = string> = T | (U & {});

export interface AnyModel<T extends ObjectHash = ObjectHash> {
	get<K extends keyof T>(key: K): T[K];
	set<K extends keyof T>(key: K, value: T[K]): void;
	off<K extends keyof T>(
		eventName?: LiteralUnion<`change:${K & string}` | "msg:custom"> | null,
		callback?: EventHandler | null,
	): void;
	on(
		eventName: "msg:custom",
		callback: (msg: any, buffers: DataView[]) => void,
	): void;
	on<K extends `change:${keyof T & string}`>(
		eventName: K,
		callback: K extends `change:${infer Key}` ? ChangeEventHandler<T[Key]>
			: never,
	): void;
	on<K extends `change:${string}`>(
		eventName: K,
		callback: ChangeEventHandler<any>,
	): void;
	on(eventName: string, callback: EventHandler): void;
	save_changes(): void;
	send(
		content: any,
		callbacks?: any,
		buffers?: ArrayBuffer[] | ArrayBufferView[],
	): void;
	widget_manager: IWidgetManager;
}

export type Experimental = {
	invoke: <T>(
		name: string,
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
