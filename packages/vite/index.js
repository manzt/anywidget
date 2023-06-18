/** @type {(src: string) => string} */
let template = (src) => `
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
window.addEventListener("unhandledrejection", (e) => showErrorOverlay(e.reason));

import.meta.hot.accept("${src}", (newModule) => {
	for (let context of import.meta.hot.data.contexts) {
		context.render = newModule.render;
	}
	refresh();
});

export async function render({ model, el } ) {
	let m = await import("${src}");
	if (import.meta.hot.data.contexts == null) {
		import.meta.hot.data.contexts = [];
	}
	import.meta.hot.data.contexts.push({
		render: m.render,
		cleanup: noop,
		model: model,
		el: el,
	});
	refresh();
}

async function refresh() {
	for (let context of import.meta.hot.data.contexts) {
		try {
			await context.cleanup();
		} catch (e) {
			console.warn("[anywidget] error cleaning up previous module.", e);
			context.cleanup = noop;
		}
		context.model.off();
		emptyElement(context.el);
		let cleanup = await context.render({ model: context.model, el: context.el });
		context.cleanup = cleanup ?? noop;
	}
}
`;

/** @returns {import("vite").Plugin} */
export default function () {
	return {
		name: "anywidget",
		apply: "serve",
		resolveId(id) {
			if (id.startsWith("anywidget:")) {
				return "\0" + id;
			}
		},
		load(id) {
			if (id.startsWith("\0anywidget:")) {
				return template(id.split(":")[1]);
			}
		},
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url.endsWith("?anywidget")) {
					// turn into a bare identifier
					let path = req.url.slice(0, -"?anywidget".length);
					req.url = "anywidget:" + path;
				}
				next();
			});
		},
	};
}
