import * as solid from "solid-js";
import * as util from "./util.js";

/**
 * This is a trick so that we can cleanup event listeners added
 * by the user-defined function.
 */
let INITIALIZE_MARKER = Symbol("anywidget.initialize");

export class Runtime {
	/** @type {() => void} */
	#disposer = () => {};
	/** @type {Set<() => void>} */
	#view_disposers = new Set();
	/** @type {import('solid-js').Resource<util.Result<import("./types.js").AnyWidget & { url: string }>>} */
	// @ts-expect-error - Set synchronously in constructor.
	#widget_result;

	/** @param {import("./model.js").Model<{ _esm: string, _css?: string, _anywidget_id: string }>} model */
	constructor(model) {
		this.#disposer = solid.createRoot((dispose) => {
			let [css, set_css] = solid.createSignal(model.get("_css"));
			model.on("change:_css", () => {
				let id = model.get("_anywidget_id");
				console.debug(`[anywidget] css hot updated: ${id}`);
				set_css(model.get("_css"));
			});
			solid.createEffect(() => {
				let id = model.get("_anywidget_id");
				util.load_css(css(), id);
			});

			/** @type {import("solid-js").Signal<string>} */
			let [esm, setEsm] = solid.createSignal(model.get("_esm"));
			model.on("change:_esm", async () => {
				let id = model.get("_anywidget_id");
				console.debug(`[anywidget] esm hot updated: ${id}`);
				setEsm(model.get("_esm"));
			});
			/** @type {void | (() => import("vitest").Awaitable<void>)} */
			let cleanup;
			this.#widget_result = solid.createResource(esm, async (update) => {
				await util.safe_cleanup(cleanup, "initialize");
				try {
					await model.state_change;
					let widget = await util.load_widget(update);
					cleanup = await widget.initialize?.({
						model: util.model_proxy(model, INITIALIZE_MARKER),
					});
					return util.ok(widget);
				} catch (e) {
					return util.error(e);
				}
			})[0];
			return () => {
				cleanup?.();
				model.off("change:_css");
				model.off("change:_esm");
				dispose();
			};
		});
	}

	/**
	 * @param {import("./view.js").View<any>} view
	 * @returns {Promise<() => void>}
	 */
	async create_view(view) {
		let model = view.model;
		let disposer = solid.createRoot((dispose) => {
			/** @type {void | (() => import("vitest").Awaitable<void>)} */
			let cleanup;
			let resource =
				solid.createResource(this.#widget_result, async (widget_result) => {
					cleanup?.();
					// Clear all previous event listeners from this hook.
					model.off(null, null, view);
					util.empty(view.el);
					if (widget_result.state === "error") {
						util.throw_anywidget_error(widget_result.error);
					}
					let widget = widget_result.data;
					try {
						cleanup = await widget.render?.({
							model: util.model_proxy(model, view),
							el: view.el,
						});
					} catch (e) {
						util.throw_anywidget_error(e);
					}
				})[0];
			solid.createEffect(() => {
				if (resource.error) {
					// TODO: Show error in the view?
				}
			});
			return () => {
				dispose();
				cleanup?.();
			};
		});
		// Have the runtime keep track but allow the view to dispose itself.
		this.#view_disposers.add(disposer);
		return () => {
			let deleted = this.#view_disposers.delete(disposer);
			if (deleted) disposer();
		};
	}

	dispose() {
		this.#view_disposers.forEach((dispose) => dispose());
		this.#view_disposers.clear();
		this.#disposer();
	}
}
