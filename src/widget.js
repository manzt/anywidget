// @ts-check
import { name, version } from "../package.json";

/**
 *  @typedef AnyWidgetRenderer
 *  @prop render {(view: import("@jupyter-widgets/base").DOMWidgetView) => Promise<void>}
 */

/**
 * Returns a hash code from a string
 * @param  {string} str The string to hash.
 * @return A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
function hash_code(str) {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		let chr = str.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

/**
 * @param {string} str
 * @returns {str is "https://${string}" | "http://${string}"}
 */
function is_href(str) {
	return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * @param {string} href
 * @returns {Promise<void>}
 */
async function load_css_href(href) {
	if (document.querySelector(`link[href='${href}']`)) return;
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
	if (is_href(css)) return load_css_href(css);
	return load_css_text(css, anywidget_id);
}

/**
 * @param {string} esm
 * @returns {Promise<AnyWidgetRenderer>}
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
			await load_css(this.model.get("_css"), this.model.get("_anywidget_id"));
			let widget = await load_esm(this.model.get("_module"));
			await widget.render(this);
		}
	}

	return { AnyModel, AnyView };
}
