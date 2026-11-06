import type { AnyModel, Experimental } from "@anywidget/types";
import type { DOMWidgetModel, DOMWidgetView, WidgetModel } from "@jupyter-widgets/base";
import * as solid from "solid-js";

import { BINDINGS } from "./binding.ts";
import { getDefinition, locateAsset } from "./definition.ts";
import { createHost } from "./host.ts";
import { invoke } from "./invoke.ts";
import { type AnyWidget, loadCss } from "./load.ts";
import { observe } from "./observe.ts";
import { assert, type Result, throwAnywidgetError } from "./util.ts";

interface State {
  [key: string]: unknown;
  _anywidget_id: string;
}

type Source = Record<string, string | undefined>;

export class Runtime {
  // @ts-expect-error - Set synchronously in constructor.
  #widgetResult: solid.Accessor<Result<AnyWidget>>;
  #signal: AbortSignal;

  constructor(model: DOMWidgetModel, options: { signal: AbortSignal }) {
    this.#signal = options.signal;
    this.#signal.throwIfAborted();
    this.#signal.addEventListener("abort", () => dispose());
    let binding = BINDINGS.getOrCreate(model);
    let experimental: Experimental = {
      // @ts-expect-error - invoke.bind loses generic type parameter
      invoke: invoke.bind(null, model),
    };
    let dispose = solid.createRoot((dispose) => {
      // DOMWidgetModel is untyped by trait shape; we know the anywidget traits, so narrow to AnyModel<State> for type-safe `.get()` access
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- see above
      let typedModel = model as unknown as AnyModel<State>;
      let id = typedModel.get("_anywidget_id");
      // `_esm` and `_css` are inline source on this model, or references to
      // shared asset models. Inline: one evaluation and one <style> per
      // widget class id. Shared: one per asset, across every model using it.
      let cssSource = locateAsset(model, "_css");
      let css = observe(asSource(cssSource.owner), cssSource.attr, { signal: this.#signal });
      let cssKey = cssSource.owner === model ? id : cssSource.owner.model_id;
      let esmSource = locateAsset(model, "_esm");
      let definition = getDefinition(esmSource.owner, esmSource.attr);
      let [widgetResult, setWidgetResult] = solid.createSignal<Result<AnyWidget>>({
        status: "pending",
      });
      this.#widgetResult = widgetResult;

      solid.createEffect(
        solid.on(css, () => console.debug(`[anywidget] css hot updated: ${id}`), { defer: true }),
      );
      solid.createEffect(() => {
        return loadCss(css(), cssKey);
      });
      solid.createEffect(() => {
        let result = definition.widget();
        if (result.status !== "ready") {
          setWidgetResult(result);
          return;
        }
        // Per-effect controller so a stale bind from a previous definition
        // cannot overwrite a newer one. Solid fires onCleanup before re-running
        // the effect, aborting the prior bind.
        let controller = new AbortController();
        solid.onCleanup(() => controller.abort());
        binding
          .bind(result.data, { experimental })
          .then(() => {
            if (controller.signal.aborted) return;
            setWidgetResult(result);
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            setWidgetResult({ status: "error", error });
          });
      });

      return dispose;
    });
  }

  async createView(view: DOMWidgetView, options: { signal: AbortSignal }): Promise<void> {
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
    let host = createHost(model, { signal });
    let dispose = solid.createRoot((dispose) => {
      solid.createEffect(() => {
        // Clear all previous event listeners from this hook.
        model.off(null, null, view);
        view.$el.empty();
        let result = this.#widgetResult();
        if (result.status === "pending") {
          return;
        }
        if (result.status === "error") {
          throwAnywidgetError(result.error);
          return;
        }
        let controller = new AbortController();
        solid.onCleanup(() => controller.abort());
        Promise.resolve()
          .then(() =>
            binding.createView(view, {
              signal: AbortSignal.any([signal, controller.signal]),
              experimental,
              host,
            }),
          )
          .catch((error) => throwAnywidgetError(error));
      });
      return () => dispose();
    });
  }
}

function asSource(model: WidgetModel): AnyModel<Source> {
  // WidgetModel is untyped by trait shape; `observe` needs the AnyModel
  // surface, which WidgetModel provides structurally.
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- see above
  return model as unknown as AnyModel<Source>;
}
