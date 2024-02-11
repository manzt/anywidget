// @ts-check
let fs = require("node:fs/promises");
let path = require("node:path");
let esbuild = require("esbuild");
let pkg = require("../package.json");

let root = path.join(__dirname, "..");
let src = path.join(root, "src");
let dist = path.join(root, "dist");

async function build() {
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
		path.join(root, "../../anywidget/nbextension/index.js"),
	);

	// re-export all exports from @anywidget/types
	await fs.writeFile(
		path.join(dist, "types.d.ts"),
		`export * from "@anywidget/types";`,
	);
	await fs.writeFile(path.join(dist, "types.mjs"), "");
	await fs.writeFile(path.join(dist, "types.cjs"), "");
}

module.exports = build;

if (require.main === module) {
	build().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
