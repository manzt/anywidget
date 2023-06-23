import { describe, expect, it } from "vitest";

import * as widgets from "@jupyter-widgets/base";
import * as baseManager from "@jupyter-widgets/base-manager";

import create_anywidget from "../src/widget.js";

let anywidget = create_anywidget(widgets);
let num_coms = 0;
let noop = () => {};

class MockComm implements widgets.IClassicComm {
	comm_id: string;
	target_name: string;
	_msgid = 0;
	_on_msg: (msg: any) => void = noop;
	_on_open: () => void = noop;
	_on_close: () => void = noop;

	constructor() {
		this.comm_id = `mock-comm-id-${num_coms}`;
		this.target_name = `mock-target-name-${num_coms}`;
		num_coms += 1;
	}
	on_open(fn: () => void): void {
		this._on_open = fn;
	}
	on_close(fn: (x: any) => void): void {
		this._on_close = () => fn(undefined);
	}
	on_msg(fn: (msg: any) => void): void {
		this._on_msg = fn;
	}
	async _process_msg(msg: any) {
		this._on_msg(msg);
	}
	open() {
		this._on_open();
		return "dummy";
	}
	close() {
		this._on_close();
		return "dummy";
	}
	send() {
		this._msgid += 1;
		return this._msgid.toString();
	}
}

class DummyManager extends baseManager.ManagerBase {
	el: HTMLElement;

	constructor() {
		super();
		this.el = document.createElement("div");
	}

	async display_view(
		_msg: unknown,
		view: widgets.DOMWidgetView,
		_options: unknown,
	) {
		// TODO: make this a spy
		// TODO: return an html element
		return Promise.resolve(view).then((view) => {
			this.el.appendChild(view.el);
			view.on("remove", () => console.log("view removed", view));
			return view.el;
		});
	}

	async loadClass(
		className: string,
		moduleName: string,
		_moduleVersion: string,
	): Promise<any> {
		let mod: Record<string, any> | undefined = {
			"@jupyter-widgets/base": widgets,
			"anywidget": anywidget,
		}[moduleName];
		return mod?.[className] ?? (() => {
			throw new Error(`Cannot find module ${moduleName}`);
		})();
	}

	async _get_comm_info() {
		return {};
	}

	async _create_comm() {
		return new MockComm();
	}
}

let _esm = `\
export function render(view) {}
`;

describe("AnyModel", async () => {
	it("loads", async () => {
		let widget_manager = new DummyManager();

		let model = await widget_manager.new_widget({
			model_name: "AnyModel",
			model_module: "anywidget",
			model_module_version: "0.1.0",
			view_name: "AnyView",
			view_module: "anywidget",
			view_module_version: "0.1.0",
		}, { _esm });

		expect(model).toBeInstanceOf(anywidget.AnyModel);
	});
});
