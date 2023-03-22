// @ts-check
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import * as esbuild from "esbuild";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let src = path.join(__dirname, "src");
let dist = path.join(__dirname, "dist");

await esbuild.build({
	entryPoints: [path.join(src, "index.js")],
	bundle: true,
	format: "esm",
	outfile: path.join(dist, "index.js"),
});

// re-export all exports from @anywidget/vite
await fs.writeFile(
	path.join(dist, "vite.mjs"),
	`export * from "@anywidget/vite";`,
);
await fs.writeFile(
	path.join(dist, "vite.cjs"),
	`module.exports = require("@anywidget/vite");`,
);

// re-export all exports from @anywidget/types
await fs.writeFile(
	path.join(dist, "types.d.ts"),
	`export * from "@anywidget/types";`,
);
await fs.writeFile(path.join(dist, "types.mjs"), "");
await fs.writeFile(path.join(dist, "types.cjs"), "");
