import type { DOMWidgetModel, DOMWidgetView } from "@jupyter-widgets/base";

type ObjectHash = Record<string, any>;
type MaybePromise<T> = T | Promise<T>;
type CleanupFn = () => MaybePromise<void>;

export interface AnyModel<T extends ObjectHash = ObjectHash>
	extends DOMWidgetModel {
	get<K extends keyof T>(key: K): T[K];
	set<K extends keyof T>(key: K, value: T[K]): void;
}

export interface RenderContext<Model> {
	model: Model;
	el: HTMLElement;
}

export interface Render<T extends ObjectHash = ObjectHash> {
	(context: RenderContext<AnyModel<T>>): MaybePromise<void | CleanupFn>;
}
