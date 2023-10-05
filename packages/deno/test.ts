import * as mock from "https://deno.land/std@0.202.0/testing/mock.ts";
import { _internals, widget } from "./mod.ts";

Deno.test("widget() initializes the front end", async () => {
	let jupyter_broadcast = mock.spy(_internals, "jupyter_broadcast");
	try {
		let model = await widget({
			state: { value: 0 },
			imports: "BLAH",
			render: async ({ model, el }) => {},
		});
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
							"_model_module_version": "0.6.5",
							"_view_module": "anywidget",
							"_view_name": "AnyView",
							"_view_module_version": "0.6.5",
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
							"_esm": "BLAH\nexport const render = async ({ model, el })=>{}",
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
		let model = await widget({
			state: { value: 0 },
			render: async () => {},
		});
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

Deno.test("Explicit anywidget version overrides the default", async () => {
	let jupyter_broadcast = mock.spy(_internals, "jupyter_broadcast");
	let version = "VERSION";
	let model = await widget({
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
