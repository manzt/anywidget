import type { AnyModel } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";

/**
 * This is a trick so that we can cleanup event listeners added
 * by the user-defined function.
 */
export let INITIALIZE_MARKER = Symbol("anywidget.initialize");

/**
 * Prunes the view down to the minimum context necessary.
 *
 * Calls to `model.get` and `model.set` automatically add the
 * `context`, so we can gracefully unsubscribe from events
 * added by user-defined hooks.
 */
export function modelProxy(model: DOMWidgetModel, context: unknown): AnyModel {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- DOMWidgetModel.get/set/on/off have wider signatures than AnyModel, so bound versions don't narrow cleanly; the shape is structurally compatible
  return {
    get: model.get.bind(model),
    set: model.set.bind(model),
    save_changes: model.save_changes.bind(model),
    send: model.send.bind(model),
    on(name, callback) {
      model.on(name, callback, context);
    },
    off(name, callback) {
      model.off(name, callback, context);
    },
    // The widget_manager type is wider than what we want to expose to
    // developers. In a future version, we will expose a more limited API but
    // that can wait for a minor version bump.
    widget_manager: model.widget_manager,
  } as AnyModel;
}
