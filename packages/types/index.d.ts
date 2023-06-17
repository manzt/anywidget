type MaybePromise<T> = T | Promise<T>;

type ObjectHash = Record<string, any>;
type CleanupFn = () => MaybePromise<void>;

/**
 * JavaScript events (used in the methods of the Events interface)
 */
interface EventHandler {
	(...args: any[]): void;
}

export interface AnyModel<T extends ObjectHash = ObjectHash> {
	get<K extends keyof T>(key: K): T[K];
	set<K extends keyof T>(key: K, value: T[K]): void;
	save_changes(): void;
    on(eventName: string, callback: EventHandler): void;
    off(eventName?: string | null, callback?: EventHandler | null): void;
}

export interface RenderContext<Model> {
	model: Model;
	el: HTMLElement;
}

export interface Render<T extends ObjectHash = ObjectHash> {
	(context: RenderContext<AnyModel<T>>): MaybePromise<void | CleanupFn>;
}
