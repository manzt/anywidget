// @ts-check
import { name, version } from "../package.json";

/** @typedef {typeof import("@jupyter-widgets/base").DOMWidgetModel} DOMWidgetModelConstructor */
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

let anywidgetMarker = Symbol("anywidget");

/**
 * This is a generic function that allows us to override properties
 * on exiting objects, without mutating the original object.
 *
 * Primary use case:
 *
 * All **anywidget** users derive from the same `AnyModel` class, so we can't
 * allow them to modify `AnyModel` itself. However, Jupyter Widgets access
 * the serializers for a given model via the model _instance_ constructor
 * (i.e., `model.constructor`).
 *
 * We can assign a Proxy for `AnyModel` to the instance `model.constructor`,
 * effectively enabling re-definition of properties on `AnyModel` for a
 * `model` _instance_. We use this mechanism inject additional `serializers`,
 * which aren't statically defined.
 *
 * @template {Record<PropertyKey, any>} T
 * @template {keyof T} OverrideKeys
 * @param {T} obj
 * @param {{ [K in OverrideKeys]: T[K] }} overrides
 */
function readonly_proxy(obj, overrides) {
	/** @type {ISerializers} */
	return new Proxy(obj, {
		get(target, prop, receiver) {
			// tag our proxy
			if (prop === anywidgetMarker) return true;
			// inject overrides
			if (prop in overrides) return overrides[prop];
			// allow original object to handle the rest
			return Reflect.get(target, prop, receiver);
		},
		set() {
			throw new TypeError(`anywidget object is read-only.`);
		},
		deleteProperty() {
			throw new TypeError(`anywidget object is read-only.`);
		},
	});
}

/**
 * @param {DOMWidgetView} view
 * @param {{ Model: DOMWidgetModelConstructor, widget: AnyWidgetModule }} options
 */
async function setup_model(view, { Model, widget }) {
	let seen_model = view.model.constructor[anywidgetMarker] === true;

	if (!seen_model && widget.serializers) {
		/**
		 * First time we've seen this model instance. Need to
		 * first apply user-defined serializers to the existing
		 * model state (i.e., `model.attributes`),
		 *
		 * {@link https://github.com/jupyter-widgets/ipywidgets/blob/74774dae5becb9f4781c3438a5fece1f8ca60415/packages/base-manager/src/manager-base.ts#L608-L618 Widget Model creation}
		 */

		// TODO: allow users to override `DOMWidgetModel.serializers`?
		// Seems like more trouble than it's worth, just pick a new name
		// and keep things simple.
		for (let key in widget.serializers) {
			if (key in Model.serializers) {
				throw TypeError(
					`Overrides for built-in serializers are not supported by anywidget.`,
				);
			}
		}

		let ModelWithOnlyAnyWidgetSerializers = readonly_proxy(Model, {
			serializers: widget.serializers,
		});

		/**
		 * Deserialize the current original state with only
		 * the user-defined serializers. `Model.serializers`
		 * have already been applied to the state, so we avoid
		 * their re-application. This is why we check above that
		 * there is no overlap between the `Model.serializers`
		 * and `widget.serializers`.
		 *
		 * See {@link https://github.com/jupyter-widgets/ipywidgets/blob/74774dae5becb9f4781c3438a5fece1f8ca60415/packages/base/src/widget.ts#L648-L672 DOMWidgetModel\._deserialize_state}
		 */
		let state = await ModelWithOnlyAnyWidgetSerializers._deserialize_state(
			view.model.attributes,
			view.model.widget_manager,
		);

		view.model.set_state(state);
	}

	// Ensure all subsequent uses of `model.constructor`
	// have the combined serializers.
	view.model.constructor = readonly_proxy(Model, {
		serializers: {
			...Model.serializers,
			...widget.serializers,
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
	}

	class AnyView extends base.DOMWidgetView {
		async render() {
			await load_css(this.model.get("_css"), this.model.get("_anywidget_id"));
			let widget = await load_esm(
				this.model.get("_esm") ?? this.model.get("_module"),
			);
			await setup_model(this, { Model: AnyModel, widget });
			await widget.render(this);
		}
	}

	return { AnyModel, AnyView };
}
