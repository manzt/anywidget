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
			let mod = await this.#load_esm().catch(err => {
				console.error("Failed to load `anywidget` ESM");
				throw err;
			})
			mod.render(this);
		}

		#load_esm() {
			/** @type {string} */
			let _module = this.model.get("_module");
			let uri = _module.startsWith("http://")
				? _module
				: `data:text/javascript;base64, ${btoa(_module)}`;
			return import(/* webpackIgnore: true */ uri);
		}
	}

	return { AnyModel, AnyView };
}
