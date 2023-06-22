import { name, version } from "../package.json";

/**
 *  @typedef AnyWidgetModule
 *  @prop render {import("@anywidget/types").Render}
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

/**
 * @param {import("@jupyter-widgets/base").DOMWidgetView} view
 * @returns {import("@anywidget/types").RenderContext}
 *
 * Prunes the view down to the minimum context necessary for rendering.
 * Calls to `model.get` and `model.set` automatically add the view as
 * context to the model, so we can gracefully unsubscribe from events
 * added by the user-defined render.
 */
function extract_context(view) {
	/** @type {import("@anywidget/types").AnyModel} */
	let model = {
		get: view.model.get.bind(view.model),
		set: view.model.set.bind(view.model),
		save_changes: view.model.save_changes.bind(view.model),
		send: view.model.send.bind(view.model),
		// @ts-expect-error
		on(name, callback) {
			view.model.on(name, callback, view);
		},
		off(name, callback) {
			view.model.off(name, callback, view);
		},
	};
	return { model, el: view.el };
}

/** @param {typeof import("@jupyter-widgets/base")} base */
export default function ({ DOMWidgetModel, DOMWidgetView }) {
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

				let views = (/** @type {unknown} */ (Object.values(this.views ?? {})));

				for await (let view of (/** @type {Promise<AnyView>[]} */ (views))) {
					// load updated esm
					let widget = await load_esm(this.get("_esm"));

					// call any cleanup logic defined by the previous module.
					try {
						await view._anywidget_cached_cleanup();
					} catch (e) {
						console.warn("[anywidget] error cleaning up previous module.", e);
						view._anywidget_cached_cleanup = () => {};
					}

					// Remove all event listeners added by the user-defined render.
					this.off(null, null, view);

					// `view.$el` is a cached jQuery object for the view's element.
					// This removes all child nodes but avoids deleting the root so
					// we can rerender.
					view.$el.empty();

					// render the view with the updated render
					let cleanup = await widget.render(extract_context(view));

					view._anywidget_cached_cleanup = cleanup ?? (() => {});
				}
			});
		}
	}

	class AnyView extends DOMWidgetView {
		async render() {
			await load_css(this.model.get("_css"), this.model.get("_anywidget_id"));
			let widget = await load_esm(this.model.get("_esm"));
			let cleanup = await widget.render(extract_context(this));
			this._anywidget_cached_cleanup = cleanup ?? (() => {});
		}

		/** @type {() => Promise<void> | void} */
		_anywidget_cached_cleanup() {}

		async remove() {
			// call any user-defined cleanup logic before this view is completely removed.
			await this._anywidget_cached_cleanup();
			return super.remove();
		}
	}

	return { AnyModel, AnyView };
}
