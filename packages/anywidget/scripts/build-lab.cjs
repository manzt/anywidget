// @ts-check
let fs = require("node:fs");
let path = require("node:path");
let webpack = require("webpack");
let pkg = require("../package.json");

let out = path.resolve(__dirname, "..", pkg.jupyterlab.outputDir);
fs.rmSync(out, { recursive: true, force: true });

/** @type {webpack.Configuration} */
let config = {
	mode: "production",
	optimization: { minimize: false },
	devtool: "source-map",
	output: {
		filename: "[name].[contenthash:8].js",
		path: path.resolve(out, "static"),
	},
	plugins: [
		new webpack.DefinePlugin({
			"globalThis.VERSION": JSON.stringify(pkg.version),
		}),
		new webpack.container.ModuleFederationPlugin({
			name: pkg.name,
			filename: "remoteEntry.[contenthash:8].js",
			library: {
				type: "var",
				name: ["_JUPYTERLAB", pkg.name],
			},
			exposes: {
				"./extension": path.resolve(__dirname, "..", pkg.jupyterlab.extension),
			},
			shared: {
				"@jupyter-widgets/base": {
					singleton: true,
					import: false,
				},
			},
		}),
		{
			apply(/** @type {webpack.Compiler} */ compiler) {
				compiler.hooks.afterEmit.tap("AfterEmitPlugin", (compilation) => {
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
				});
			},
		},
	],
};

webpack(config, (_, stats) => {
	console.log(stats?.toString({ colors: true, errors: true }));
});
