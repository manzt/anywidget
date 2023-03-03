// @ts-check
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import * as esbuild from "esbuild";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let src = path.join(__dirname, "..", "src");
let dist = path.join(__dirname, "..", "dist");

// bundle the widget
await esbuild.build({
	entryPoints: [path.join(src, "index.js")],
	bundle: true,
	format: "esm",
	outfile: path.join(dist, "index.js"),
});

// Just copy over the ESM
await fs.copyFile(
	path.join(src, "vite-plugin.js"),
	path.join(dist, "vite.mjs"),
);

// Transform the vite plugin to CJS
await esbuild.build({
	entryPoints: [path.join(src, "vite-plugin.js")],
	format: "cjs",
	outfile: path.join(dist, "vite.cjs"),
});


// Copy over the types and create empty files
await fs.copyFile(
	path.join(src, "types.d.ts"),
	path.join(dist, "types.d.ts"),
);
await fs.writeFile(path.join(dist, "types.mjs"), "");
await fs.writeFile(path.join(dist, "types.cjs"), "");
