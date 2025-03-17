import { afterEach, describe, expect, it } from "vitest";

import * as widgets from "@jupyter-widgets/base";
import * as baseManager from "@jupyter-widgets/base-manager";

import create_anywidget from "../src/widget.js";

let anywidget = create_anywidget(widgets);
let num_comms = 0;

class MockComm implements widgets.IClassicComm {
	comm_id = `mock-comm-id-${num_comms++}`;
	target_name = "dummy";
	_on_open: ((x?: unknown) => void) | null = null;
	_on_msg: ((x?: unknown) => void) | null = null;
	_on_close: ((x?: unknown) => void) | null = null;

	on_open(fn: () => void): void {
		this._on_open = fn;
	}

	on_close(fn: (x: any) => void): void {
		this._on_close = fn;
	}

	on_msg(fn: (x: any) => void): void {
		this._on_msg = fn;
	}

	async _process_msg(msg: any): Promise<void> {
		if (this._on_msg) {
			return this._on_msg(msg);
		}
	}

	open(): string {
		if (this._on_open) {
			this._on_open();
		}
		return "";
	}

	close(): string {
		if (this._on_close) {
			this._on_close();
		}
		return "";
	}

	send(): string {
		return "";
	}
}

class Manager extends baseManager.ManagerBase {
	el = document.createElement("div");

	async display_view(
		_msg: unknown,
		view: widgets.DOMWidgetView,
		_options: unknown,
	) {
		// TODO: make this a spy
		// TODO: return an html element
		this.el.appendChild(view.el);
		view.on("remove", () => console.log("view removed", view));
		return view.el;
	}

	async loadClass(
		className: string,
		moduleName: string,
		_moduleVersion: string,
	): Promise<any> {
		if (moduleName === "@jupyter-widgets/base" && className in widgets) {
			// @ts-expect-error - Types can't narrow here
			return widgets[className];
		}
		if (moduleName === "anywidget" && className in anywidget) {
			// @ts-expect-error - Types can't narrow here
			return anywidget[className];
		}
		throw new Error(`Cannot find module ${moduleName}`);
	}

	_get_comm_info(): never {
		throw new Error("Should not be called.");
	}

	_create_comm(): never {
		throw new Error("Should not be called.");
	}
}

let _esm = `\
export default { render() {} };
`;

describe("AnyModel", async () => {
	let widget_manager = new Manager();
	document.body.appendChild(widget_manager.el);
	afterEach(async () => {
		widget_manager.el.replaceChildren();
		widget_manager.clear_state();
	});

	it("AnyModel", async () => {
		let model = new anywidget.AnyModel(
			{ _esm },
			{
				comm: new MockComm(),
				model_id: widgets.uuid(),
				widget_manager: widget_manager,
			},
		);
		expect(model).toBeInstanceOf(anywidget.AnyModel);
	});

	// TODO: Node doesn't support importing blob URLs,
	// which we rely on in the front end.
	it.skip("loads", async () => {
		let model = await widget_manager.new_model(
			{
				model_name: "AnyModel",
				model_module: "anywidget",
				model_module_version: "0.1.0",
				view_name: "AnyView",
				view_module: "anywidget",
				view_module_version: "0.1.0",
				model_id: widgets.uuid(),
				comm: new MockComm(),
			},
			{ _esm },
		);

		expect(model).toBeInstanceOf(anywidget.AnyModel);
	});
});
