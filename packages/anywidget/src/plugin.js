// This file is bundled by `jupyterlab extension build`
import * as base from "@jupyter-widgets/base";
import create from "./widget.js";
import { name, version } from "../package.json";

/**
 * @typedef JupyterLabRegistry
 * @property {(widget: { name: string, version: string, exports: any }) => void} registerWidget
 */

export default {
	id: `${name}:plugin`,
	requires: [base.IJupyterWidgetRegistry],
	activate: (
		/** @type {unknown} */ _app,
		/** @type {JupyterLabRegistry} */ registry,
	) => {
		let exports = create(base);
		registry.registerWidget({ name, version, exports });
	},
	autoStart: true,
};
