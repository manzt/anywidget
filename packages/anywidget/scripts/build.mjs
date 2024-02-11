// @ts-check
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import * as esbuild from "esbuild";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let pkg_path = path.join(__dirname, "../package.json");
let pkg = await fs.readFile(pkg_path, "utf-8").then(JSON.parse);
let src = path.join(__dirname, "../src");
let dist = path.join(__dirname, "../dist");

await esbuild.build({
	entryPoints: [path.join(src, "index.js")],
	bundle: true,
	format: "esm",
	outfile: path.join(dist, "index.js"),
	define: {
		"globalThis.VERSION": JSON.stringify(pkg.version),
	},
});

await fs.copyFile(
	path.join(dist, "index.js"),
	path.join(__dirname, "../../../anywidget/nbextension/index.js"),
);

// re-export all exports from @anywidget/types
await fs.writeFile(
	path.join(dist, "types.d.ts"),
	`export * from "@anywidget/types";`,
);
await fs.writeFile(path.join(dist, "types.mjs"), "");
await fs.writeFile(path.join(dist, "types.cjs"), "");
