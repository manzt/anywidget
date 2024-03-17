import * as utils from "./util.js";
import { Widget } from "@lumino/widgets";

/**
 * @template {Record<string, unknown>} T
 * @typedef {import("./model.js").Model<T>} Model
 */

/**
 * @typedef LuminoMessage
 * @property {string} type
 * @property {boolean} isConflatable
 * @property {(msg: LuminoMessage) => boolean} conflate
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
	/** @type {() => void} */
	#remove_callback = () => {};

	/** @param {ViewOptions<T>} options */
	constructor({ el, model, ...options }) {
		this.el = el ?? document.createElement("div");
		this.model = model;
		this.options = options;
		this.luminoWidget = new Widget({ node: this.el });
	}

	/**
	 * @param {Model<T>} model
	 * @param {"destroy"} name
	 * @param {() => void} callback
	 */
	listenTo(model, name, callback) {
		utils.assert(
			name === "destroy",
			"[anywidget]: Only 'destroy' event is supported in `listenTo`.",
		);
		model.once("destroy", callback);
	}

	/**
	 * @param {"remove"} name
	 * @param {() => void} callback
	 */
	once(name, callback) {
		utils.assert(
			name === "remove",
			"[anywidget]: Only 'remove' event is supported in `once`.",
		);
		this.#remove_callback = callback;
	}

	remove() {
		this.#remove_callback();
		this.el.remove();
	}

	/**
	 * Render the view.
	 */
	async render() {}
}
