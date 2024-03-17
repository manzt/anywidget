import { assert } from "./util.js";
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
	#remove_callback = () => { };

	/** @param {ViewOptions<T>} options */
	constructor(options) {
		this.el = options.el ?? document.createElement("div");
		this.model = options.model;
		this.options = options;
		this.luminoWidget = new Widget({ node: this.el });
	}

	/**
	 * @param {Model<T>} model
	 * @param {"destroy"} name
	 * @param {() => void} callback
	 */
	listenTo(model, name, callback) {
		assert(name === "destroy", "Only 'destroy' event is supported in `listenTo`.");
		model.on(name, callback);
	}

	/**
	 * @param {"remove"} name
	 * @param {() => void} callback
	 */
	once(name, callback) {
		assert(name === "remove", "Only 'remove' event is supported in `once`.");
		this.#remove_callback = callback;
	}

	remove() {
		this.#remove_callback();
		this.el.remove();
	}

	/**
	 * @param {LuminoMessage} msg
	 */
	processLuminoMessage(msg) {
		switch (msg.type) {
			case 'after-attach':
				this.trigger('displayed');
				break;
			case 'show':
				this.trigger('shown');
				break;
		}
	}

	/**
	 * @param {"displayed" | "shown"} name
	 */
	trigger(name) {
		console.log(name)
	}

	/**
	 * Render the view.
	 */
	async render() { }

}
