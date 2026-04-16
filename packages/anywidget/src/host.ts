import type { Host } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";

import { BINDINGS } from "./binding.ts";
import { invoke } from "./invoke.ts";
import { modelProxy } from "./model-proxy.ts";
import { parseWidgetRef } from "./widget-ref.ts";

export function createHost(model: DOMWidgetModel, { signal }: { signal: AbortSignal }): Host {
  let host: Host = {
    // @ts-expect-error - modelProxy returns AnyModel; generic T is erased at runtime
    async getModel(ref) {
      let modelId = parseWidgetRef(ref);
      let childModel = await model.widget_manager.get_model(modelId);
      let context = Symbol("anywidget.host.getModel");
      signal.addEventListener("abort", () => childModel.off(null, null, context));
      return modelProxy(childModel, context);
    },
    // @ts-expect-error - generic T is erased at runtime, exports typed as unknown
    async getWidget(ref) {
      let modelId = parseWidgetRef(ref);
      let childModel = await model.widget_manager.get_model(modelId);
      let childBinding = BINDINGS.get(childModel);
      if (!childBinding) {
        throw new Error(`[anywidget] No binding found for widget ${modelId}`);
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      let exports = await new Promise<unknown>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`[anywidget] Timed out waiting for widget ${modelId} to initialize`)),
          10_000,
        );
        childBinding.ready.then(resolve, reject);
      }).finally(() => clearTimeout(timer));
      return {
        exports,
        async render({ el, signal: viewSignal }) {
          let childViewSignal = viewSignal ?? signal;
          await childBinding.createView(
            { el },
            {
              signal: childViewSignal,
              experimental: {
                // @ts-expect-error - bind isn't working
                invoke: invoke.bind(null, childModel),
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
