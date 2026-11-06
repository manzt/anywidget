import type { WidgetModel } from "@jupyter-widgets/base";

/**
 * Two kinds of reference travel in synced state.
 *
 * A widget reference, `"anywidget:<model_id>"`, names a peer widget. Authors
 * resolve it at render time through `host`.
 *
 * An asset reference, `"anywidget-asset:<id>"`, names a shared `_esm` or
 * `_css` source. The runtime resolves it before the widget's code runs, and
 * `host` refuses it.
 */
export let WIDGET_REF_PREFIX = "anywidget:";
export let ASSET_REF_PREFIX = "anywidget-asset:";

export function parseWidgetRef(ref: unknown): string {
  if (typeof ref === "string" && ref.startsWith(WIDGET_REF_PREFIX)) {
    return ref.slice(WIDGET_REF_PREFIX.length);
  }
  throw new Error(`[anywidget] Invalid widget reference: ${JSON.stringify(ref)}`);
}

export function isAssetRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ASSET_REF_PREFIX);
}

export function parseAssetRef(ref: unknown): string {
  if (isAssetRef(ref)) {
    return ref.slice(ASSET_REF_PREFIX.length);
  }
  throw new Error(`[anywidget] Invalid asset reference: ${JSON.stringify(ref)}`);
}

/** Structural check for a resolved model: anything with `get` and `on`. */
export function isModel(value: unknown): value is WidgetModel {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function" &&
    "on" in value &&
    typeof value.on === "function"
  );
}
