import type { Experimental, Host } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";

import type { AnyWidget } from "./load.ts";
import { INITIALIZE_MARKER, modelProxy } from "./model-proxy.ts";
import { type Awaitable, promiseWithResolvers, safeCleanup } from "./util.ts";

/**
 * The minimal surface `createView` needs from a view-like object. The object
 * identity is used as the listener context for `modelProxy`, and `el` is the
 * render target.
 */
export interface ViewTarget {
  el: HTMLElement;
}

function isSafeCleanupFunction(x: unknown): x is () => Awaitable<void> {
  return typeof x === "function";
}

export class WidgetBinding {
  #controller: AbortController | undefined;
  #widgetDef: AnyWidget | undefined;
  #exports: unknown;
  #model: DOMWidgetModel;
  ready: Promise<unknown>;
  #resolvers: PromiseWithResolvers<unknown>;

  constructor(model: DOMWidgetModel) {
    this.#model = model;
    this.#resolvers = promiseWithResolvers();
    this.ready = this.#resolvers.promise;
  }

  async bind(
    widgetDef: AnyWidget,
    { experimental }: { experimental: Experimental },
  ): Promise<void> {
    if (this.#widgetDef === widgetDef) return;

    if (this.#widgetDef && this.#widgetDef !== widgetDef) {
      this.#controller?.abort();
      this.#resolvers = promiseWithResolvers();
      this.ready = this.#resolvers.promise;
    }

    this.#widgetDef = widgetDef;
    this.#controller = new AbortController();
    let signal = this.#controller.signal;
    let model = this.#model;

    model.off(null, null, INITIALIZE_MARKER);

    let result = await widgetDef.initialize?.({
      model: modelProxy(model, INITIALIZE_MARKER),
      signal,
      experimental,
    });

    if (signal.aborted) {
      await safeCleanup(isSafeCleanupFunction(result) ? result : undefined, "esm update");
      return;
    }

    if (isSafeCleanupFunction(result)) {
      signal.addEventListener("abort", () => safeCleanup(result, "esm update"));
      this.#exports = undefined;
    } else if (typeof result === "object" && result !== null) {
      this.#exports = result;
    } else {
      this.#exports = undefined;
    }

    this.#resolvers.resolve(this.#exports);
  }

  async createView(
    target: ViewTarget,
    { signal, experimental, host }: { signal: AbortSignal; experimental: Experimental; host: Host },
  ): Promise<(() => void) | undefined> {
    await this.ready;
    if (!this.#widgetDef?.render) return;
    let controller = new AbortController();
    let combined = AbortSignal.any([signal, controller.signal]);
    let model = this.#model;
    let cleanup = await this.#widgetDef.render({
      model: modelProxy(model, target),
      el: target.el,
      signal: combined,
      host,
      experimental,
    });
    let disposeView = (reason: string): void => {
      // Clear listeners keyed to this target. For ephemeral `{el}` targets
      // (host.getWidget().render), this prevents leaks across re-renders.
      model.off(null, null, target);
      void safeCleanup(cleanup, reason);
    };
    if (combined.aborted) {
      disposeView("dispose view - already aborted");
      return;
    }
    combined.addEventListener("abort", () => disposeView("dispose view - aborted"));
    return () => controller.abort();
  }

  get exports(): unknown {
    return this.#exports;
  }

  destroy(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#widgetDef = undefined;
  }
}

class BindingManager {
  #bindings = new Map<DOMWidgetModel, WidgetBinding>();

  getOrCreate(model: DOMWidgetModel): WidgetBinding {
    let binding = this.#bindings.get(model);
    if (!binding) {
      binding = new WidgetBinding(model);
      this.#bindings.set(model, binding);
    }
    return binding;
  }

  get(model: DOMWidgetModel): WidgetBinding | undefined {
    return this.#bindings.get(model);
  }

  destroy(model: DOMWidgetModel): void {
    let binding = this.#bindings.get(model);
    if (binding) {
      binding.destroy();
      this.#bindings.delete(model);
    }
  }
}

export let BINDINGS = new BindingManager();
