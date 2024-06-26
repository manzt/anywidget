import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const query = "?anywidget";
const namespace = "anywidget:";
const resolvedNamespace = `\0${namespace}`;

let dirname = path.dirname(url.fileURLToPath(import.meta.url));
let hmrTemplate = fs.readFileSync(path.resolve(dirname, "hmr.js"), {
	encoding: "utf-8",
});

/** @returns {import("vite").Plugin} */
export default function () {
	return {
		name: "anywidget",
		apply: "serve",
		resolveId(id) {
			if (id.startsWith(namespace)) {
				return `\0${id}`;
			}
		},
		async load(id) {
			if (id.startsWith(resolvedNamespace)) {
				let src = id.split(":")[1];
				return hmrTemplate.replaceAll("__ANYWIDGET_HMR_SRC__", src);
			}
		},
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url?.endsWith(query)) {
					// turn into a bare identifier
					let path = req.url.slice(0, -query.length);
					req.url = `${namespace}${path}`;
				}
				next();
			});
		},
	};
}
