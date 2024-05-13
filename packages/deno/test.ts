import * as mock from "@std/testing/mock";
import { _internals, widget } from "./src/mod.ts";

Deno.test("widget() initializes the front end", async () => {
	let jupyter_broadcast = mock.spy(_internals, "jupyter_broadcast");
	try {
		let model = widget({
			state: { value: 0 },
			imports: "BLAH",
			render: async ({ model, el }) => {},
		});
		let init_promise = _internals.get_init_promise(model);
		await init_promise;
		mock.assertSpyCalls(jupyter_broadcast, 2);
		mock.assertSpyCall(jupyter_broadcast, 0, {
			args: [
				"comm_open",
				{
					"comm_id": _internals.get_comm(model).id,
					"target_name": "jupyter.widget",
					"data": {
						"state": {
							"_model_module": "anywidget",
							"_model_name": "AnyModel",
							"_model_module_version": _internals.version,
							"_view_module": "anywidget",
							"_view_name": "AnyView",
							"_view_module_version": _internals.version,
							"_view_count": null,
						},
					},
				},
				{
					"metadata": { "version": "2.1.0" },
				},
			],
		});
		mock.assertSpyCall(jupyter_broadcast, 1, {
			args: [
				"comm_msg",
				{
					"comm_id": _internals.get_comm(model).id,
					"data": {
						"method": "update",
						"state": {
							"value": 0,
							"_esm":
								"BLAH\nexport default { render: async ({ model, el })=>{} }",
						},
					},
				},
			],
		});
	} finally {
		jupyter_broadcast.restore();
	}
});

Deno.test("model.set() sends change events to the front end", async () => {
	let jupyter_broadcast = mock.spy(_internals, "jupyter_broadcast");
	try {
		let model = widget({
			state: { value: 0 },
			render: async ({ model, el }) => {},
		});
		await _internals.get_init_promise(model);
		model.set("value", 1);
		mock.assertSpyCall(jupyter_broadcast, 2, {
			args: ["comm_msg", {
				"comm_id": _internals.get_comm(model).id,
				"data": { "method": "update", "state": { "value": 1 } },
			}],
		});
	} finally {
		jupyter_broadcast.restore();
	}
});

Deno.test("Explicit anywidget version overrides the default", () => {
	let jupyter_broadcast = mock.spy(_internals, "jupyter_broadcast");
	let version = "VERSION";
	let model = widget({
		state: { value: 0 },
		render: async () => {},
		version: version,
	});
	mock.assertSpyCall(jupyter_broadcast, 0, {
		args: [
			"comm_open",
			{
				"comm_id": _internals.get_comm(model).id,
				"target_name": "jupyter.widget",
				"data": {
					"state": {
						"_model_module": "anywidget",
						"_model_name": "AnyModel",
						"_model_module_version": version,
						"_view_module": "anywidget",
						"_view_name": "AnyView",
						"_view_module_version": version,
						"_view_count": null,
					},
				},
			},
			{
				"metadata": { "version": "2.1.0" },
			},
		],
	});
});
