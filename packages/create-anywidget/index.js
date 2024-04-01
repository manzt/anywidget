#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as _p from "@clack/prompts";
import { bold, cyan, grey } from "kleur/colors";

import { create } from "./create.js";

let p = new Proxy(_p, {
	/**
	 * @template {keyof _p} T
	 * @param {typeof _p} target
	 * @param {T} prop
	 */
	get(target, prop) {
		if (prop === "select" || prop === "text" || prop == "confirm") {
			let fn = /** @type {(typeof _p)["text"]} */ (target[prop]);
			/** @type {typeof fn} */
			return async (opts) => {
				let { value } = await target.group({
					value: () => fn(opts),
				});
				return value;
			};
		}
		return Reflect.get(target, prop);
	},
});

// https://github.com/withastro/astro/blob/fca6892f8d6a30ceb1e04213be2414dd4cb4d389/packages/create-astro/src/actions/context.ts#L110-L115
function detect_package_manager() {
	// @ts-ignore
	if (typeof Bun !== "undefined") return "bun";
	if (!process.env.npm_config_user_agent) return;
	const specifier = process.env.npm_config_user_agent.split(" ")[0];
	const name = specifier.substring(0, specifier.lastIndexOf("/"));
	return name === "npminstall" ? "cnpm" : name;
}

let pkg = await fs.promises
	.readFile(new URL("package.json", import.meta.url), "utf-8")
	.then(JSON.parse);

let cwd = process.argv[2] || ".";

console.clear();
console.log(`
${grey(`create-anywidget version ${pkg.version}`)}
`);

p.intro("Welcome to anywidget!");

if (cwd === ".") {
	let dir = await p.text({
		message: "Where should we create your project?",
		placeholder: "  (hit Enter to use current directory)",
	});
	if (p.isCancel(dir)) {
		process.exit(1);
	}
	if (dir) {
		cwd = dir;
	}
}

if (fs.existsSync(cwd) && fs.readdirSync(cwd).length > 0) {
	let force = await p.confirm({
		message: "Directory not empty. Continue?",
		initialValue: false,
	});
	// bail if `force` is `false` or the user cancelled with Ctrl-C
	if (force !== true) {
		process.exit(1);
	}
}

/** @type { "vanilla" | "react"  | symbol } */
let framework = await p.select({
	message: "Which framework?",
	options: [
		{
			label: "Vanilla",
			hint: "No framework, just JS and CSS.",
			value: "vanilla",
		},
		{
			label: "React",
			hint: "React with JSX",
			value: "react",
		},
	],
});

if (p.isCancel(framework)) {
	process.exit(1);
}

let pkg_manager = detect_package_manager() ?? "npm";
let bundler = pkg_manager === "bun" ? "bun" : "esbuild";

/** @type {string | symbol} */
let template = await p.select({
	message: "Which variant?",
	options: {
		vanilla: [
			{
				label: "JavaScript (minimal)",
				hint: "No front-end tooling. Requires CDN-only imports.",
				value: "template-vanilla-deno-jsdoc",
			},
			{
				label: "JavaScript",
				hint: `Bundles dependencies with ${bundler}.`,
				value: "template-vanilla",
			},
			{
				label: "TypeScript",
				hint: `Bundles dependencies with ${bundler}.`,
				value: "template-vanilla-ts",
			},
		],
		react: [
			{
				label: "JavaScript",
				hint: `Transforms JSX and bundles dependencies with ${bundler}.`,
				value: "template-react",
			},
			{
				label: "TypeScript",
				hint: `Transforms JSX and bundles dependencies with ${bundler}.`,
				value: "template-react-ts",
			},
		],
	}[framework],
});

if (p.isCancel(template)) {
	process.exit(1);
}

await create(cwd, {
	name: path.basename(path.resolve(cwd)),
	template: /** @type {import("./create.js").TemplateType} */ (template),
	pkg_manager,
}).catch((err) => {
	console.error("Error writing files:", err);
	process.exit(1);
});

p.outro("Your project is ready!");

console.log("\nNext steps:");
let i = 1;

const relative = path.relative(process.cwd(), cwd);
if (relative !== "") {
	console.log(`  ${i++}: ${bold(cyan(`cd ${relative}`))}`);
}

if (template !== "template-vanilla-deno-jsdoc") {
	console.log(`  ${i++}: ${bold(cyan(`${pkg_manager} install`))}`);
}

// dprint-ignore
console.log(
	`  ${i++}: ${
		bold(cyan('git init && git add -A && git commit -m "Initial commit"'))
	} (optional)`,
);

if (template !== "template-vanilla-deno-jsdoc") {
	console.log(`  ${i++}: ${bold(cyan(`${pkg_manager} run dev`))}`);
	console.log(`\nTo close the dev server, hit ${bold(cyan("Ctrl-C"))}`);
}

console.log(
	`\nStuck? Visit us at ${cyan("https://github.com/manzt/anywidget")}`,
);
