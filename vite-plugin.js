let template = (src) => `
import.meta.hot.accept("${src}", (newModule) => {
	import.meta.hot.data.render = newModule.render;
	refresh();
});

export async function render(view) {
	if (!import.meta.hot.data.render) {
		let m = await import("${src}");
		import.meta.hot.data.render = m.render;
	}
	import.meta.hot.data.view = view;
	refresh();
}

async function refresh() {
	let data = import.meta.hot.data;
	// clear event listeners
	data.view.model.off();
	let views = await Promise.all(
		Object.values(data.view.model.views)
	);
	for (let view of views) {
		// clean up all child elements
		while (view.el.firstChild) {
			view.el.removeChild(view.el.firstChild);
		}
		data.render(view);
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
			server.middlewares.use((req, res, next) => {
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
