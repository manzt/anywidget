import type { AnyModel } from "@anywidget/types";
import type { WidgetModel } from "@jupyter-widgets/base";
import * as solid from "solid-js";

import { type AnyWidget, loadWidget } from "./load.ts";
import { observe } from "./observe.ts";
import { isModel } from "./refs.ts";
import type { Result } from "./util.ts";

/**
 * A widget definition (the AFM default export) loaded from one source.
 *
 * `widget()` is `pending` until the module has been evaluated, then `ready`
 * with the definition, or `error`. A change to the source re-evaluates the
 * module and yields a new `ready` value; the previous one stays current until
 * then.
 */
export interface Definition {
  widget: solid.Accessor<Result<AnyWidget>>;
}

/**
 * One definition per (owner model, attribute). Entries are removed when the
 * owner is destroyed.
 */
let DEFINITIONS = new WeakMap<WidgetModel, Map<string, Definition>>();

/**
 * Get (or create) the definition loaded from `owner.get(attr)`.
 *
 * The owner is the identity: every caller that passes the same model and
 * attribute shares one module evaluation. Passing a widget model and its
 * `_esm` gives one evaluation per widget instance. Passing a shared asset
 * model and its `contents` gives one evaluation per asset.
 */
export function getDefinition(owner: WidgetModel, attr: string): Definition {
  let byAttr = DEFINITIONS.get(owner);
  if (!byAttr) {
    byAttr = new Map();
    DEFINITIONS.set(owner, byAttr);
  }
  let definition = byAttr.get(attr);
  if (!definition) {
    definition = createDefinition(owner, attr);
    byAttr.set(attr, definition);
  }
  return definition;
}

/**
 * Where the value of `attr` lives: on the model itself (inline source), or on
 * the shared asset model it references, whose source is its `contents`.
 *
 * Decided once per runtime. The kernel never swaps an asset for a string or
 * vice versa on a live model; hot reload flows through whichever owner holds
 * the source.
 */
export function locateAsset(
  model: WidgetModel,
  attr: string,
): { owner: WidgetModel; attr: string } {
  let value: unknown = model.get(attr);
  return isModel(value) ? { owner: value, attr: "contents" } : { owner: model, attr };
}

function createDefinition(owner: WidgetModel, attr: string): Definition {
  let controller = new AbortController();
  let { widget, dispose } = solid.createRoot((dispose) => {
    // WidgetModel is untyped by trait shape; `observe` needs the AnyModel
    // surface, which WidgetModel provides structurally.
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- see above
    let typedOwner = owner as unknown as AnyModel<Record<string, string>>;
    let id = typedOwner.get("_anywidget_id") ?? owner.model_id;
    let source = observe(typedOwner, attr, { signal: controller.signal });
    let [widget, setWidget] = solid.createSignal<Result<AnyWidget>>({ status: "pending" });

    solid.createEffect(
      solid.on(source, () => console.debug(`[anywidget] esm hot updated: ${id}`), {
        defer: true,
      }),
    );
    solid.createEffect(() => {
      // Per-effect controller so a stale load from a previous source cannot
      // overwrite a newer one. Solid runs onCleanup before re-running the
      // effect, aborting the prior load.
      let loadController = new AbortController();
      solid.onCleanup(() => loadController.abort());
      loadWidget(source(), id)
        .then((data) => {
          if (loadController.signal.aborted) return;
          setWidget({ status: "ready", data });
        })
        .catch((error: unknown) => {
          if (loadController.signal.aborted) return;
          setWidget({ status: "error", error });
        });
    });

    return {
      widget,
      dispose: (): void => {
        dispose();
        controller.abort();
      },
    };
  });
  owner.once("destroy", () => {
    dispose();
    DEFINITIONS.get(owner)?.delete(attr);
  });
  return { widget };
}
