function noop() {}

function emptyElement(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

function showErrorOverlay(err) {
	let ErrorOverlay = customElements.get("vite-error-overlay");
	// don't open outside vite environment
	if (!ErrorOverlay) return;
	let overlay = new ErrorOverlay(err);
	document.body.appendChild(overlay);
}

window.addEventListener("error", showErrorOverlay);
window.addEventListener("unhandledrejection", (e) =>
	showErrorOverlay(e.reason),
);

async function getRender(newModule) {
	let newRender = newModule.render;
	if (newRender) {
		console.warn(
			'[anywidget] Deprecation Warning. Direct export of a "render" will likely be deprecated in the future.',
		);
		return newRender;
	}
	newRender = newModule.default;
	if (!newRender) {
		throw new Error(
			"[anywidget] module must export a default function or object.",
		);
	}
	return typeof newRender === "function" ? await newRender() : newRender.render;
}

import.meta.hot.accept("__ANYWIDGET_HMR_SRC__", async (newModule) => {
	import.meta.hot.data.render = await getRender(newModule);
	refresh();
});

async function render({ model, el }) {
	if (import.meta.hot.data.render == null) {
		let m = await import("__ANYWIDGET_HMR_SRC__");
		import.meta.hot.data.render = await getRender(m);
	}
	if (import.meta.hot.data.contexts == null) {
		import.meta.hot.data.contexts = [];
	}
	import.meta.hot.data.contexts.push({ cleanup: noop, model, el });
	refresh();
}

async function refresh() {
	let render = import.meta.hot.data.render;
	for (let context of import.meta.hot.data.contexts) {
		try {
			await context.cleanup();
		} catch (e) {
			console.debug("[anywidget] error cleaning up previous module.", e);
			context.cleanup = noop;
		}
		context.model.off();
		emptyElement(context.el);
		let cleanup = await render({ model: context.model, el: context.el });
		context.cleanup = cleanup ?? noop;
	}
}

export default { render };
