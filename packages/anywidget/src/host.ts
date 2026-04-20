import type { Host } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";

import { BINDINGS } from "./binding.ts";
import { invoke } from "./invoke.ts";
import { model_proxy } from "./model-proxy.ts";
import { parse_widget_ref } from "./widget-ref.ts";

export function create_host(model: DOMWidgetModel, { signal }: { signal: AbortSignal }): Host {
  let host: Host = {
    // @ts-expect-error - model_proxy returns AnyModel; generic T is erased at runtime
    async getModel(ref) {
      let model_id = parse_widget_ref(ref);
      let child_model = await model.widget_manager.get_model(model_id);
      let context = Symbol("anywidget.host.getModel");
      signal.addEventListener("abort", () => child_model.off(null, null, context));
      return model_proxy(child_model, context);
    },
    // @ts-expect-error - generic T is erased at runtime, exports typed as unknown
    async getWidget(ref) {
      let model_id = parse_widget_ref(ref);
      let child_model = await model.widget_manager.get_model(model_id);
      let child_binding = BINDINGS.get(child_model);
      if (!child_binding) {
        throw new Error(`[anywidget] No binding found for widget ${model_id}`);
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      let exports = await new Promise<unknown>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`[anywidget] Timed out waiting for widget ${model_id} to initialize`)),
          10_000,
        );
        child_binding.ready.then(resolve, reject);
      }).finally(() => clearTimeout(timer));
      return {
        exports,
        async render({ el, signal: view_signal }) {
          let child_view_signal = view_signal ?? signal;
          await child_binding.create_view(
            { el },
            {
              signal: child_view_signal,
              experimental: {
                // @ts-expect-error - bind isn't working
                invoke: invoke.bind(null, child_model),
              },
              host,
            },
          );
        },
      };
    },
  };
  return host;
}
