type MaybePromise<T> = T | Promise<T>;
type ObjectHash = Record<string, any>;
type CleanupFn = () => MaybePromise<void>;

/**
 * JavaScript events (used in the methods of the Events interface)
 */
interface EventHandler {
	(...args: any[]): void;
}

/**
 * Utility type to infer possible event names from a model.
 *
 * Autocomplete works for literal string unions, but adding a union
 * of `string` negates autocomplete entirely. This is a workaround
 * to provide autocomplete but still allow any string.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729
 */
type EventName<T extends PropertyKey> = `change:${T & string}` | 'msg:custom' | (string & {});

export interface AnyModel<T extends ObjectHash = ObjectHash> {
	get<K extends keyof T>(key: K): T[K];
	set<K extends keyof T>(key: K, value: T[K]): void;
	off<K extends keyof T>(eventName?: EventName<K> | null, callback?: EventHandler | null): void;
	on<K extends keyof T>(eventName: EventName<K>, callback: EventHandler): void;
	save_changes(): void;
	send(content: any, callbacks?: any, buffers?: ArrayBuffer[] | ArrayBufferView[]): void;
}

export interface RenderContext<T extends ObjectHash = ObjectHash> {
	model: AnyModel<T>;
	el: HTMLElement;
}

export interface Render<T extends ObjectHash = ObjectHash> {
	(context: RenderContext<T>): MaybePromise<void | CleanupFn>;
}
