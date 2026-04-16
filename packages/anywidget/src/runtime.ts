import type { AnyModel, Experimental } from "@anywidget/types";
import type { DOMWidgetModel, DOMWidgetView } from "@jupyter-widgets/base";
import * as solid from "solid-js";

import { BINDINGS } from "./binding.ts";
import { create_host } from "./host.ts";
import { invoke } from "./invoke.ts";
import { type AnyWidget, load_css, load_widget } from "./load.ts";
import { observe } from "./observe.ts";
import { assert, promise_with_resolvers, type Result, throw_anywidget_error } from "./util.ts";

interface State {
  [key: string]: unknown;
  _esm: string;
  _anywidget_id: string;
  _css: string | undefined;
}

export class Runtime {
  // @ts-expect-error - Set synchronously in constructor.
  #widget_result: solid.Accessor<Result<AnyWidget>>;
  #signal: AbortSignal;
  ready: Promise<void>;

  constructor(model: DOMWidgetModel, options: { signal: AbortSignal }) {
    let resolvers = promise_with_resolvers<void>();
    this.ready = resolvers.promise;
    this.#signal = options.signal;
    this.#signal.throwIfAborted();
    this.#signal.addEventListener("abort", () => dispose());
    AbortSignal.timeout(2000).addEventListener("abort", () => {
      resolvers.reject(new Error("[anywidget] Failed to initialize model."));
    });
    let binding = BINDINGS.get_or_create(model);
    let experimental: Experimental = {
      // @ts-expect-error - invoke.bind loses generic type parameter
      invoke: invoke.bind(null, model),
    };
    let dispose = solid.createRoot((dispose) => {
      // DOMWidgetModel is untyped by trait shape; we know the anywidget traits, so narrow to AnyModel<State> for type-safe `.get()` access
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- see above
      let typed_model = model as unknown as AnyModel<State>;
      let id = typed_model.get("_anywidget_id");
      let css = observe(typed_model, "_css", { signal: this.#signal });
      let esm = observe(typed_model, "_esm", { signal: this.#signal });
      let [widget_result, set_widget_result] = solid.createSignal<Result<AnyWidget>>({
        status: "pending",
      });
      this.#widget_result = widget_result;

      solid.createEffect(
        solid.on(css, () => console.debug(`[anywidget] css hot updated: ${id}`), { defer: true }),
      );
      solid.createEffect(
        solid.on(esm, () => console.debug(`[anywidget] esm hot updated: ${id}`), { defer: true }),
      );
      solid.createEffect(() => {
        return load_css(css(), id);
      });
      solid.createEffect(() => {
        load_widget(esm(), id)
          .then(async (widget) => {
            await binding.bind(widget, { experimental });
            set_widget_result({ status: "ready", data: widget });
            resolvers.resolve();
          })
          .catch((error) => set_widget_result({ status: "error", error }));
      });

      return dispose;
    });
  }

  async create_view(view: DOMWidgetView, options: { signal: AbortSignal }): Promise<void> {
    let model = view.model;
    let signal = AbortSignal.any([this.#signal, options.signal]); // either model or view destroyed
    signal.throwIfAborted();
    signal.addEventListener("abort", () => dispose());
    let binding = BINDINGS.get(model);
    assert(binding, "[anywidget] WidgetBinding not found.");
    let experimental: Experimental = {
      // @ts-expect-error - invoke.bind loses generic type parameter
      invoke: invoke.bind(null, model),
    };
    let host = create_host(model, { signal });
    let dispose = solid.createRoot((dispose) => {
      solid.createEffect(() => {
        // Clear all previous event listeners from this hook.
        model.off(null, null, view);
        view.$el.empty();
        let result = this.#widget_result();
        if (result.status === "pending") {
          return;
        }
        if (result.status === "error") {
          throw_anywidget_error(result.error);
        }
        let controller = new AbortController();
        solid.onCleanup(() => controller.abort());
        Promise.resolve()
          .then(() =>
            binding.create_view(view, {
              signal: AbortSignal.any([signal, controller.signal]),
              experimental,
              host,
            }),
          )
          .catch((error) => throw_anywidget_error(error));
      });
      return () => dispose();
    });
  }
}
