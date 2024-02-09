import { name, version } from "../package.json";
import { Runtime } from "./runtime.js";

/** @param {typeof import("@jupyter-widgets/base")} base */
export default function ({ DOMWidgetModel, DOMWidgetView }) {
	/** @type {WeakMap<AnyModel, Runtime>} */
	let RUNTIMES = new WeakMap();

	class AnyModel extends DOMWidgetModel {
		static model_name = "AnyModel";
		static model_module = name;
		static model_module_version = version;

		static view_name = "AnyView";
		static view_module = name;
		static view_module_version = version;

		/** @param {Parameters<InstanceType<DOMWidgetModel>["initialize"]>} args */
		initialize(...args) {
			super.initialize(...args);
			RUNTIMES.set(this, new Runtime(this));
		}

		/** @type {import('@jupyter-widgets/base').DOMWidgetModel["destroy"]} */
		destroy(options) {
			RUNTIMES.get(this)?.dispose();
			return super.destroy(options);
		}

		/**
		 * @param {Record<string, any>} state
		 *
		 * We override to support binary trailets because JSON.parse(JSON.stringify())
		 * does not properly clone binary data (it just returns an empty object).
		 *
		 * https://github.com/jupyter-widgets/ipywidgets/blob/47058a373d2c2b3acf101677b2745e14b76dd74b/packages/base/src/widget.ts#L562-L583
		 */
		serialize(state) {
			let serializers =
				/** @type {DOMWidgetModel} */ (this.constructor).serializers || {};
			for (let k of Object.keys(state)) {
				try {
					let serialize = serializers[k]?.serialize;
					if (serialize) {
						state[k] = serialize(state[k], this);
					} else if (k === "layout" || k === "style") {
						// These keys come from ipywidgets, rely on JSON.stringify trick.
						state[k] = JSON.parse(JSON.stringify(state[k]));
					} else {
						state[k] = structuredClone(state[k]);
					}
					if (typeof state[k]?.toJSON === "function") {
						state[k] = state[k].toJSON();
					}
				} catch (e) {
					console.error("Error serializing widget state attribute: ", k);
					throw e;
				}
			}
			return state;
		}
	}

	class AnyView extends DOMWidgetView {
		#disposer = () => {};
		async render() {
			this.#disposer();
			this.#disposer = await RUNTIMES.get(this.model)?.add_view(this) ??
				(() => {});
		}
		remove() {
			this.#disposer();
			super.remove();
		}
	}

	return { AnyModel, AnyView };
}
