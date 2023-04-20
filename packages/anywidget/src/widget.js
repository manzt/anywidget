// @ts-check
import { name, version } from "../package.json";

/** @typedef {import("@jupyter-widgets/base").WidgetView} WidgetView */

/**
 *  @typedef AnyWidgetModule
 *  @prop render {(view: WidgetView) => Promise<undefined | (() => Promise<void>)>}
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
	let widget;
	try {
		widget = await import(/* webpackIgnore: true */ url);
	} catch (e) {
		console.log(e);
		throw e;
	}
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

		/** @param {Parameters<InstanceType<base["DOMWidgetModel"]>["initialize"]>} args */
		initialize(...args) {
			super.initialize(...args);

			// Handles CSS updates from anywidget during development.
			this.on("change:_css", () => {
				let id = this.get("_anywidget_id");
				// _esm/_css/_anywidget_id traits are set dynamically within `anywidget.AnyWidget.__init__`,
				// and due to the implementation of ipywidgets fire separate change messages to the front end.
				// This can cause an issue where we have CSS but we don't have an ID. This early return
				// make sure we only apply styles that we can replace.
				if (!id) return;
				console.debug(`[anywidget] css hot updated: ${id}`);
				load_css(this.get("_css"), id);
			});

			// Handles ESM updates from anywidget during development.
			this.on("change:_esm", async () => {
				let id = this.get("_anywidget_id");
				if (!id) return;
				console.debug(`[anywidget] esm hot updated: ${id}`);

				for await (let view of Object.values(this.views ?? {})) {
					// load updated esm
					let widget = await load_esm(this.get("_esm"));

					// call any cleanup logic defined by the previous module.
					await (/** @type {AnyView} */ (view))._anywidget_cached_cleanup();

					// `view.$el` is a cached jQuery object for the view's element.
					// This removes all child nodes but avoids deleting the root so
					// we can rerender.
					view.$el.empty();

					// Unsubscribe from any handlers registered to `view.listenTo`
					// Sadly we can't just `model.off` because it removes everything,
					// including handlers not setup by the child view.
					//
					// We could override `model.on` with a particular `context` if none is
					// provided, letting us unsubscribe from only events from views
					// e.g., `model.off(null, null, anywidgetSymbol)`, but that might
					// be more trouble than it's worth and this is just a feature for
					// development.
					view.stopListening(this);

					// render the view with the updated render
					let cleanup = await widget.render(view);
					if (cleanup) this._anywidget_cached_cleanup = cleanup;
				}
			});
		}
	}

	class AnyView extends base.DOMWidgetView {
		async render() {
			await load_css(this.model.get("_css"), this.model.get("_anywidget_id"));
			let widget = await load_esm(this.model.get("_esm"));
			let cleanup = await widget.render(this);
			if (cleanup) this._anywidget_cached_cleanup = cleanup;
		}

		async _anywidget_cached_cleanup() {}

		async remove() {
			// call any user-defined cleanup logic before this view is completely removed.
			await this._anywidget_cached_cleanup();
			return super.remove();
		}
	}

	return { AnyModel, AnyView };
}
