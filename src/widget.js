import { name, version } from "../package.json";

/** @param {typeof import("@jupyter-widgets/base")} base */
export default function (base) {
	class AnyModel extends base.DOMWidgetModel {
		static model_name = "AnyModel";
		static model_module = name;
		static model_module_version = version;

		static view_name = "AnyView";
		static view_module = name;
		static view_module_version = version;
	}

	class AnyView extends base.DOMWidgetView {
		async render() {
			let url, cleanup;
			let esm = this.model.get("_module");

			if (
				esm.startsWith("http://") ||
				esm.startsWith("https://")
			) {
				url = esm;
				cleanup = () => {};
			} else {
				let blob = new Blob([esm], { type: "text/javascript" });
				url = URL.createObjectURL(blob);
				cleanup = () => URL.revokeObjectURL(url);
			}

			let anywidget = await import(/* webpackIgnore: true */ url).catch(
				(err) => {
					console.error("Failed to load `anywidget` ESM");
					throw err;
				},
			);

			await anywidget.render(this);

			cleanup();
		}
	}

	return { AnyModel, AnyView };
}
