/** @type {(src: string) => string} */
let template = (src) => `
let noop = () => {};

import.meta.hot.accept("${src}", (newModule) => {
	import.meta.hot.data.render = newModule.render;
	refresh();
});

export async function render({ model, el } ) {
	if (!import.meta.hot.data.render) {
		let m = await import("${src}");
		import.meta.hot.data.render = m.render;
		import.meta.hot.data.cleanup = noop;
	}
	import.meta.hot.data.model = model;
	import.meta.hot.data.el = el;
	refresh();
}

function emptyElement(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

async function refresh() {
	let data = import.meta.hot.data;
	try {
		await data.cleanup();
	} catch (e) {
		console.warn("[anywidget] error cleaning up previous module.", e);
		import.meta.hot.data.cleanup = noop;
	}
	data.model.off();
	emptyElement(data.el);
	let cleanup = await data.render({ model: data.model, el: data.el });
	import.meta.hot.data.cleanup = cleanup ?? noop;
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
