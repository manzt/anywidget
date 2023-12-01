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

export interface AnyModel<
	T extends ObjectHash = ObjectHash,
	U extends ObjectHash = ObjectHash,
> {
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
	_unstable_context: U;
}

export interface RenderProps<
	T extends ObjectHash = ObjectHash,
	U extends ObjectHash = ObjectHash,
> {
	model: AnyModel<T, U>;
	el: HTMLElement;
}

export interface Render<
	T extends ObjectHash = ObjectHash,
	U extends ObjectHash = ObjectHash,
> {
	(props: RenderProps<T, U>): Awaitable<void | (() => Awaitable<void>)>;
}

export interface SetupProps<
	T extends ObjectHash = ObjectHash,
	U extends ObjectHash = ObjectHash,
> {
	model: AnyModel<T, U>;
}

export interface Setup<
	T extends ObjectHash = ObjectHash,
	U extends ObjectHash = ObjectHash,
> {
	(props: SetupProps<T, U>): Awaitable<void | (() => Awaitable<void>)>;
}
