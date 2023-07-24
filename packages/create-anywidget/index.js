#!/usr/bin/env node
// @ts-check

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as p from "@clack/prompts";
import { bold, cyan, grey } from "kleur/colors";

import { create } from "./create.js";

let pkg = await fs.promises
	.readFile(new URL("package.json", import.meta.url), "utf-8")
	.then(JSON.parse);

let cwd = process.argv[2] || ".";

console.log(`
${grey(`create-anywidget version ${pkg.version}`)}
`);

p.intro("Welcome to anywidget!");

if (cwd === ".") {
	const dir = await p.text({
		message: "Where should we create your project?",
		placeholder: "  (hit Enter to use current directory)",
	});
	if (p.isCancel(dir)) process.exit(1);
	if (dir) {
		cwd = /** @type {string} */ (dir);
	}
}

if (fs.existsSync(cwd)) {
	if (fs.readdirSync(cwd).length > 0) {
		let force = await p.confirm({
			message: "Directory not empty. Continue?",
			initialValue: false,
		});
		// bail if `force` is `false` or the user cancelled with Ctrl-C
		if (force !== true) {
			process.exit(1);
		}
	}
}

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const options = await p.group(
	{
		template: () =>
			p.select({
				message: "Which anywidget template?",
				// @ts-expect-error i have no idea what is going on here
				options: fs
					.readdirSync(__dirname)
					.filter((dir) => dir.startsWith("template-"))
					.map((dir) => {
						let title = dir.replace(/^template-/, "");
						return {
							label: title,
							hint: `A ${title} anywidget template`,
							value: dir,
						};
					}),
			}),
	},
	{ onCancel: () => process.exit(1) },
);

await create(cwd, {
	name: path.basename(path.resolve(cwd)),
	template: /** @type {'react'} */ (options.template),
});

p.outro("Your project is ready!");

console.log("\nNext steps:");
let i = 1;

const relative = path.relative(process.cwd(), cwd);
if (relative !== "") {
	console.log(`  ${i++}: ${bold(cyan(`cd ${relative}`))}`);
}

console.log(`  ${i++}: ${bold(cyan("npm install"))} (or pnpm install, etc)`);

// prettier-ignore
console.log(
	`  ${i++}: ${
		bold(cyan('git init && git add -A && git commit -m "Initial commit"'))
	} (optional)`,
);

console.log(`  ${i++}: ${bold(cyan("npm run dev"))}`);
console.log(`\nTo close the dev server, hit ${bold(cyan("Ctrl-C"))}`);
console.log(
	`\nStuck? Visit us at ${cyan("https://github.com/manzt/anywidget")}`,
);
