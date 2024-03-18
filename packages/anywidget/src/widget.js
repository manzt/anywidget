import * as util from "./util.js";
import { Runtime } from "./runtime.js";
import { Model } from "./model.js";
import { View } from "./view.js";

export default function () {
	/** @type {WeakMap<AnyModel<any>, Runtime>} */
	let RUNTIMES = new WeakMap();

	/**
	 * @template {{ _esm: string, _css?: string, _anywidget_id: string }} T
	 * @extends {Model<T>}
	 */
	class AnyModel extends Model {
		/** @param {ConstructorParameters<typeof Model<T>>} args */
		constructor(...args) {
			super(...args);
			let runtime = new Runtime(this);
			window.model = this;
			this.once("destroy", () => {
				try {
					runtime.dispose();
				} finally {
					RUNTIMES.delete(this);
				}
			});
			RUNTIMES.set(this, runtime);
		}
	}

	/** @extends {View<any>} */
	class AnyView extends View {
		/** @type {() => void} */
		#dispose = () => {};
		async render() {
			let runtime = RUNTIMES.get(/** @type {any} */ (this.model));
			util.assert(runtime, "[anywidget] runtime not found.");
			this.#dispose = await runtime.create_view(this);
		}
		remove() {
			this.#dispose();
			super.remove();
		}
	}

	return { AnyModel, AnyView };
}
