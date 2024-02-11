// @ts-check
let fs = require("node:fs");
let path = require("node:path");
let rspack = require("@rspack/core");
let pkg = require("../package.json");

let root = path.resolve(__dirname, "..");
let out = path.resolve(root, pkg.jupyterlab.outputDir);
fs.rmSync(out, { recursive: true, force: true });

/** @type {rspack.Configuration} */
module.exports = {
	mode: "production",
	optimization: { minimize: false },
	devtool: "source-map",
	entry: path.resolve(root, "src/index.js"),
	output: {
		filename: "[name].[contenthash:8].js",
		path: path.resolve(out, "static"),
	},
	plugins: [
		new rspack.DefinePlugin({
			"globalThis.VERSION": JSON.stringify(pkg.version),
		}),
		new rspack.container.ModuleFederationPluginV1({
			name: pkg.name,
			filename: "remoteEntry.[contenthash:8].js",
			library: {
				type: "var",
				name: ["_JUPYTERLAB", pkg.name],
			},
			exposes: {
				"./extension": path.resolve(root, pkg.jupyterlab.extension),
			},
			shared: {
				"@jupyter-widgets/base": {
					singleton: true,
					import: false,
				},
			},
		}),
		{
			apply(/** @type {rspack.Compiler} */ compiler) {
				compiler.hooks.afterEmit.tap(
					"CreateJupyterLabDataPlugin",
					(compilation) => {
						let entry = Object
							.keys(compilation.assets)
							.find((f) => f.startsWith("remoteEntry."));
						if (!entry) {
							throw new Error("remoteEntry not found");
						}
						let data = {
							name: pkg.name,
							version: pkg.version,
							author: pkg.author,
							lisence: pkg.license,
							jupyterlab: {
								_build: {
									load: `./static/${entry}`,
									extension: "./extension",
								},
							},
						};
						fs.writeFileSync(
							path.resolve(out, "package.json"),
							JSON.stringify(data, null, 2),
						);
					},
				);
			},
		},
		{
			apply(/** @type {rspack.Compiler} */ compiler) {
				compiler.hooks.afterEmit.tap("BundleNotebookPlugin", () => {
					let bundle = require("./build.cjs");
					bundle();
				});
			},
		},
	],
};
