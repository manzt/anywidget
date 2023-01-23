// @ts-check
import { name, version } from "../package.json";

/** @typedef {import("@jupyter-widgets/base").DOMWidgetView} DOMWidgetView */
/** @typedef {import("@jupyter-widgets/base").ISerializers} ISerializers */

/**
 *  @typedef AnyWidgetModule
 *  @prop render {(view: DOMWidgetView) => Promise<void>}
 *  @prop [serializers] {ISerializers}
 */

/**
 * @param {string} str
 * @returns {str is "https://${string}" | "http://${string}"}
 */
function is_href(str) {
	return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * @param {string} href
 * @param {string} anywidget_id
 * @returns {Promise<void>}
 */
async function load_css_href(href, anywidget_id) {
	/** @type {HTMLLinkElement | null} */
	let prev = document.querySelector(`link[id='${anywidget_id}']`);

	// Adapted from https://github.com/vitejs/vite/blob/d59e1acc2efc0307488364e9f2fad528ec57f204/packages/vite/src/client/client.ts#L185-L201
	// Swaps out old styles with new, but avoids flash of unstyled content.
	// No need to await the load since we already have styles applied.
	if (prev) {
		let newLink = /** @type {HTMLLinkElement} */ (prev.cloneNode());
		newLink.href = href;
		newLink.addEventListener("load", () => prev?.remove());
		prev.after(newLink);
		return;
	}

	return new Promise((resolve) => {
		let link = Object.assign(document.createElement("link"), {
			rel: "stylesheet",
			href,
			onload: resolve,
		});
		document.head.appendChild(link);
	});
}

/**
 * @param {string} css_text
 * @param {string} anywidget_id
 * @returns {void}
 */
function load_css_text(css_text, anywidget_id) {
	/** @type {HTMLStyleElement | null} */
	let prev = document.querySelector(`style[id='${anywidget_id}']`);
	if (prev) {
		// replace instead of creating a new DOM node
		prev.textContent = css_text;
		return;
	}
	let style = Object.assign(document.createElement("style"), {
		id: anywidget_id,
		type: "text/css",
	});
	style.appendChild(document.createTextNode(css_text));
	document.head.appendChild(style);
}

/**
 * @param {string | undefined} css
 * @param {string} anywidget_id
 * @returns {Promise<void>}
 */
async function load_css(css, anywidget_id) {
	if (!css) return;
	if (is_href(css)) return load_css_href(css, anywidget_id);
	return load_css_text(css, anywidget_id);
}

/**
 * @param {string} esm
 * @returns {Promise<AnyWidgetModule>}
 */
async function load_esm(esm) {
	if (is_href(esm)) {
		return import(/* webpackIgnore: true */ esm);
	}
	let url = URL.createObjectURL(
		new Blob([esm], { type: "text/javascript" }),
	);
	let widget = await import(/* webpackIgnore: true */ url);
	URL.revokeObjectURL(url);
	return widget;
}

let anywidgetSymbol = Symbol("anywidget");

/**
 * Jupyter Widgets define custom `serializers` on the Model class statically.
 * All **anywidget** users derive from the same `AnyModel`, so we can't allow
 * users to mutate `AnyModel` (otherwise there could be conflicting state names)
 *
 * Creating a proxy for the `model.constructor` allows us to inject serializers
 * on top of those statically defined for the Model.
 *
 * @param {typeof import("@jupyter-widgets/base").DOMWidgetModel} Model
 * @param {ISerializers=} serializers
 */
function createModelProxy(Model, serializers) {
	/** @type {ISerializers} */
	return new Proxy(Model, {
		get(target, prop, receiver) {
			// tag our proxy
			if (prop === anywidgetSymbol) return true;
			// intercept serializers
			if (prop === "serializers") return serializers;
			// allow original object to handle the rest
			return Reflect.get(target, prop, receiver);
		},
	});
}

/** @param {typeof import("@jupyter-widgets/base")} base */
export default function (base) {
	class AnyModel extends base.DOMWidgetModel {
		static model_name = "AnyModel";
		static model_module = name;
		static model_module_version = version;

		static view_name = "AnyView";
		static view_module = name;
		static view_module_version = version;

		constructor(attributes, modelOptions) {
			super(attributes, modelOptions);
			this._initial_state = attributes;
		}
	}

	class AnyView extends base.DOMWidgetView {
		async render() {
			await load_css(this.model.get("_css"), this.model.get("_anywidget_id"));
			let widget = await load_esm(
				this.model.get("_esm") ?? this.model.get("_module"),
			);
			this.model.constructor = createModelProxy(AnyModel, widget.serializers);
			let state = this.model._initial_state;
			if (state) {
				state = await this.model.constructor._deserialize_state(
					state,
					this.model.widget_manager,
				);
				this.model.set_state(state);
				this.model._initial_state;
			}
			this.model.constructor = createModelProxy(AnyModel, {
				...AnyModel.serializers,
				...widget.serializers,
			});
			await widget.render(this);
		}
	}

	return { AnyModel, AnyView };
}
