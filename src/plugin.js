// This file is bundled by `jupyterlab extension build`
import * as base from "@jupyter-widgets/base";
import create from "./widget.js";
import { name, version } from "../package.json";

export default {
	id: `${name}:plugin`,
	requires: [base.IJupyterWidgetRegistry],
	activate: (_app, registry) => {
		let exports = create(base);
		registry.registerWidget({ name, version, exports });
	},
	autoStart: true,
};
