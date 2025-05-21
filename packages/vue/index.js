import {
	createApp,
	customRef,
	defineComponent,
	h,
	inject,
	onMounted,
	onUnmounted,
	provide,
	toValue,
	unref,
} from "vue";

/**
 * @template {Record<string, any>} T
 * @typedef RenderContext
 * @property {import("@anywidget/types").AnyModel<T>} model
 * @property {import("@anywidget/types").Experimental} experimental
 */

/**
 * @type {import("vue").InjectionKey<RenderContext<any>>}
 */
const RENDER_CONTEXT_KEY = Symbol("anywidget.RenderContext");

/**
 * @returns {RenderContext<any>}
 */
function useRenderContext() {
	let ctx = inject(RENDER_CONTEXT_KEY);
	if (!ctx) throw new Error("anywidget.RenderContext is not provided.");
	return ctx;
}

/**
 * @template {Record<string, any>} T
 * @returns {import("@anywidget/types").AnyModel<T>}
 */
export function useModel() {
	let ctx = useRenderContext();
	return ctx.model;
}

/** @returns {import("@anywidget/types").Experimental} */
export function useExperimental() {
	let ctx = useRenderContext();
	return ctx.experimental;
}

/**
 * A Vue Composable to use model-backed state in a component.
 *
 * Returns a ShallowRef that synchronizes its value with
 * the underlying model provided by an anywidget host.
 *
 * @example
 * ```ts
 * import { useModelState } from "@anywidget/vue";
 *
 * function Counter() {
 *   const value = useModelState<number>("value");
 *
 *   return (
 *     <button onClick={() => value++}>
 *       Count: {value}
 *     </button>
 *   );
 * }
 * ```
 *
 * @template S
 * @param {import("vue").MaybeRef<string>} key - The name of the model field to use
 * @returns {import("vue").ShallowRef<S>}
 */
export function useModelState(key) {
	const model = useModel();

	/**
	 * @type {VoidFunction}
	 */
	let trigger;

	/**
	 * @type {import("vue").Ref<S>}
	 */
	const value = customRef((_track, _trigger) => {
		trigger = _trigger;
		return {
			get() {
				_track();
				return model.get(unref(key));
			},
			set(newValue) {
				model.set(unref(key), toValue(newValue));
				model.save_changes();
			},
		};
	});

	const update = () => {
		value.value = model.get(unref(key));
		trigger();
	};

	onMounted(() => {
		model.on(`change:${key}`, update);
	});

	onUnmounted(() => {
		model.off(`change:${key}`, update);
	});

	return value;
}

/**
 * @type {import("vue").DefineSetupFnComponent<RenderContext<any>>}
 */
const WidgetWrapper = defineComponent(
	({ model, experimental }, ctx) => {
		provide(RENDER_CONTEXT_KEY, { model, experimental });
		return () => ctx.slots?.default?.();
	},
	{
		props: ["model", "experimental"],
		name: "WidgetWrapper",
	},
);

/**
 * @param {import("vue").Component} Widget
 * @returns {import("@anywidget/types").Render}
 */
export function createRender(Widget) {
	return ({ el, model, experimental }) => {
		const app = createApp(h(WidgetWrapper, { model, experimental }, h(Widget)));
		app.mount(el);

		return () => app.unmount();
	};
}
