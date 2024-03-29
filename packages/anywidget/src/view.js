import * as util from "./util.js";
import { Widget } from "@lumino/widgets";

/**
 * @typedef LuminoMessage
 * @property {string} type
 * @property {boolean} isConflatable
 * @property {(msg: LuminoMessage) => boolean} conflate
 */

/**
 * @template {Record<string, unknown>} T
 * @typedef {import("./model.js").Model<T>} Model
 */

/**
 * @template {Record<string, unknown>} T
 * @typedef ViewOptions
 * @prop {Model<T>} model
 * @prop {HTMLElement} [el]
 * @prop {string} [id]
 */

/**
 * @template {Record<string, unknown>} T
 */
export class View {
	/** @type {HTMLElement} */
	el;
	/** @type {Model<T>} */
	model;
	/** @type {Record<string, unknown>} */
	options;
	#remove_callback = () => {};

	/** @param {ViewOptions<T>} options */
	constructor({ el, model, ...options }) {
		this.el = el ?? document.createElement("div");
		this.model = model;
		this.options = options;
		// TODO: We should try to drop the Lumino dependency. However, this seems required for all widgets.
		this.luminoWidget = new Widget({ node: this.el });
	}

	/**
	 * @param {Model<T>} model
	 * @param {"destroy"} name
	 * @param {() => void} callback
	 */
	listenTo(model, name, callback) {
		util.assert(
			name === "destroy",
			"[anywidget] Only 'destroy' event is supported in `View.listenTo`",
		);
	}

	/**
	 * @param {"remove"} name
	 * @param {() => void} callback
	 */
	once(name, callback) {
		util.assert(
			name === "remove",
			"[anywidget] Only 'remove' event is supported in `View.once`",
		);
		this.#remove_callback = callback;
	}

	remove() {
		this.luminoWidget?.dispose();
		this.#remove_callback();
		util.empty(this.el);
		this.el.remove();
		this.model.off(null, null, this);
	}

	/**
	 * Render the view.
	 *
	 * Should be overridden by subclasses.
	 *
	 * @returns {Promise<void>}
	 */
	async render() {}
}
