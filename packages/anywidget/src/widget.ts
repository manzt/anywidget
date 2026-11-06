import type { IWidgetManager } from "@jupyter-widgets/base";

import { BINDINGS } from "./binding.ts";
import { ASSET_REF_PREFIX, isAssetRef, isModel, parseAssetRef } from "./refs.ts";
import { Runtime } from "./runtime.ts";
import { assert } from "./util.ts";

// @ts-expect-error - injected by bundler
let version: string = globalThis.VERSION;

interface WidgetFactoryOptions {
  DOMWidgetModel: typeof import("@jupyter-widgets/base").DOMWidgetModel;
  DOMWidgetView: typeof import("@jupyter-widgets/base").DOMWidgetView;
  WidgetModel: typeof import("@jupyter-widgets/base").WidgetModel;
}

interface WidgetFactoryResult {
  AnyModel: typeof import("@jupyter-widgets/base").DOMWidgetModel;
  AnyView: typeof import("@jupyter-widgets/base").DOMWidgetView;
  /**
   * A shared `_esm` or `_css` value: a plain model with a `contents` trait and
   * no view. The kernel names it so hosts can recognise it; nothing on the
   * front end needs more than the base class.
   */
  AnyAssetModel: typeof import("@jupyter-widgets/base").WidgetModel;
}

/**
 * `_esm` and `_css` are inline source or an asset reference. A reference is
 * resolved to the asset model before the widget model is constructed; plain
 * strings pass through. `serialize` is the inverse; without it the override on
 * `AnyModel` would `structuredClone` a model and throw when saving widget state.
 */
let assetSerializer = {
  deserialize(value: unknown, manager?: IWidgetManager): unknown {
    if (!isAssetRef(value)) return value;
    assert(manager, "[anywidget] A widget manager is required to resolve asset references.");
    return manager.get_model(parseAssetRef(value));
  },
  serialize(value: unknown): unknown {
    return isModel(value) ? `${ASSET_REF_PREFIX}${value.model_id}` : value;
  },
};

export default function ({
  DOMWidgetModel,
  DOMWidgetView,
  WidgetModel,
}: WidgetFactoryOptions): WidgetFactoryResult {
  let RUNTIMES = new WeakMap<InstanceType<typeof DOMWidgetModel>, Runtime>();

  class AnyModel extends DOMWidgetModel {
    static model_name = "AnyModel";
    static model_module = "anywidget";
    static model_module_version = version;

    static view_name = "AnyView";
    static view_module = "anywidget";
    static view_module_version = version;

    static serializers = {
      ...DOMWidgetModel.serializers,
      _esm: assetSerializer,
      _css: assetSerializer,
    };

    initialize(...args: Parameters<InstanceType<typeof DOMWidgetModel>["initialize"]>): void {
      super.initialize(...args);
      let controller = new AbortController();
      this.once("destroy", () => {
        controller.abort("[anywidget] Runtime destroyed.");
        BINDINGS.destroy(this);
        RUNTIMES.delete(this);
      });
      RUNTIMES.set(this, new Runtime(this, { signal: controller.signal }));
    }

    /**
     * We override to support binary trailets because JSON.parse(JSON.stringify())
     * does not properly clone binary data (it just returns an empty object).
     *
     * https://github.com/jupyter-widgets/ipywidgets/blob/47058a373d2c2b3acf101677b2745e14b76dd74b/packages/base/src/widget.ts#L562-L583
     */
    serialize(state: Record<string, any>): Record<string, any> {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- accessing static `.serializers` on `this.constructor`
      let serializers = (this.constructor as typeof DOMWidgetModel).serializers || {};
      for (let k of Object.keys(state)) {
        try {
          let serialize = serializers[k]?.serialize;
          if (serialize) {
            state[k] = serialize(state[k], this);
          } else if (k === "layout" || k === "style") {
            // These keys come from ipywidgets, rely on JSON.stringify trick.
            state[k] = JSON.parse(JSON.stringify(state[k]));
          } else {
            state[k] = structuredClone(state[k]);
          }
          if (typeof state[k]?.toJSON === "function") {
            state[k] = state[k].toJSON();
          }
        } catch (e) {
          console.error("Error serializing widget state attribute: ", k);
          throw e;
        }
      }
      return state;
    }
  }

  class AnyView extends DOMWidgetView {
    #controller = new AbortController();
    async render(): Promise<void> {
      let runtime = RUNTIMES.get(this.model);
      assert(runtime, "[anywidget] Runtime not found.");
      await runtime.createView(this, { signal: this.#controller.signal });
    }
    remove(): void {
      this.#controller.abort("[anywidget] View destroyed.");
      super.remove();
    }
  }

  return { AnyModel, AnyView, AnyAssetModel: WidgetModel };
}
