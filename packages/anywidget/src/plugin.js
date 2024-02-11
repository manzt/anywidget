import * as base from "@jupyter-widgets/base";
import create from "./widget.js";

/**
 * @typedef JupyterLabRegistry
 * @property {(widget: { name: string, version: string, exports: any }) => void} registerWidget
 */

export default {
	id: "anywidget:plugin",
	requires: [base.IJupyterWidgetRegistry],
	activate: (
		/** @type {unknown} */ _app,
		/** @type {JupyterLabRegistry} */ registry,
	) => {
		let exports = create(base);
		registry.registerWidget({
			name: "anywidget",
			// @ts-expect-error Added by bundler
			version: globalThis.VERSION,
			exports,
		});
	},
	autoStart: true,
};
