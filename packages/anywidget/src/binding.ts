import type { Experimental, Host } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";

import type { AnyWidget } from "./load.ts";
import { INITIALIZE_MARKER, model_proxy } from "./model-proxy.ts";
import { type Awaitable, promise_with_resolvers, safe_cleanup } from "./util.ts";

/**
 * The minimal surface `create_view` needs from a view-like object. The object
 * identity is used as the listener context for `model_proxy`, and `el` is the
 * render target.
 */
export interface ViewTarget {
  el: HTMLElement;
}

function is_safe_cleanup_function(x: unknown): x is () => Awaitable<void> {
  return typeof x === "function";
}

export class WidgetBinding {
  #controller: AbortController | undefined;
  #widget_def: AnyWidget | undefined;
  #exports: unknown;
  #model: DOMWidgetModel;
  ready: Promise<unknown>;
  #resolvers: PromiseWithResolvers<unknown>;

  constructor(model: DOMWidgetModel) {
    this.#model = model;
    this.#resolvers = promise_with_resolvers();
    this.ready = this.#resolvers.promise;
  }

  async bind(
    widget_def: AnyWidget,
    { experimental }: { experimental: Experimental },
  ): Promise<void> {
    if (this.#widget_def === widget_def) return;

    if (this.#widget_def && this.#widget_def !== widget_def) {
      this.#controller?.abort();
      this.#resolvers = promise_with_resolvers();
      this.ready = this.#resolvers.promise;
    }

    this.#widget_def = widget_def;
    this.#controller = new AbortController();
    let signal = this.#controller.signal;
    let model = this.#model;

    model.off(null, null, INITIALIZE_MARKER);

    let result = await widget_def.initialize?.({
      model: model_proxy(model, INITIALIZE_MARKER),
      signal,
      experimental,
    });

    if (signal.aborted) {
      await safe_cleanup(is_safe_cleanup_function(result) ? result : undefined, "esm update");
      return;
    }

    if (is_safe_cleanup_function(result)) {
      signal.addEventListener("abort", () => safe_cleanup(result, "esm update"));
      this.#exports = undefined;
    } else if (typeof result === "object" && result !== null) {
      this.#exports = result;
    } else {
      this.#exports = undefined;
    }

    this.#resolvers.resolve(this.#exports);
  }

  async create_view(
    target: ViewTarget,
    { signal, experimental, host }: { signal: AbortSignal; experimental: Experimental; host: Host },
  ): Promise<(() => void) | undefined> {
    await this.ready;
    if (!this.#widget_def?.render) return;
    let controller = new AbortController();
    let combined = AbortSignal.any([signal, controller.signal]);
    let model = this.#model;
    let cleanup = await this.#widget_def.render({
      model: model_proxy(model, target),
      el: target.el,
      signal: combined,
      host,
      experimental,
    });
    let dispose_view = (reason: string): void => {
      // Clear listeners keyed to this target. For ephemeral `{el}` targets
      // (host.getWidget().render), this prevents leaks across re-renders.
      model.off(null, null, target);
      void safe_cleanup(cleanup, reason);
    };
    if (combined.aborted) {
      dispose_view("dispose view - already aborted");
      return;
    }
    combined.addEventListener("abort", () => dispose_view("dispose view - aborted"));
    return () => controller.abort();
  }

  get exports(): unknown {
    return this.#exports;
  }

  destroy(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#widget_def = undefined;
  }
}

class BindingManager {
  #bindings = new Map<DOMWidgetModel, WidgetBinding>();

  get_or_create(model: DOMWidgetModel): WidgetBinding {
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
