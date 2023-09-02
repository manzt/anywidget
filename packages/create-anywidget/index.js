#!/usr/bin/env node

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
			hint: "No dependencies",
			value: "vanilla",
		},
		{
			label: "React",
			hint: "React with JSX",
			value: "react",
		},
	]
});

if (p.isCancel(framework)) {
	process.exit(1);
}

/** @type { string | symbol } */
let template = await p.select({
	message: "Which variant?",
	options: {
		vanilla: [
			{
				label: "JavaScript",
				hint: "Plain JavaScript",
				value: "template-vanilla",
			},
			{
				label: "TypeScript",
				hint: "TypeScript",
				value: "template-vanilla-ts",
			}
		],
		react: [
			{
				label: "JavaScript",
				hint: "Plain JavaScript (JSX)",
				value: "template-react",
			}
		]
	}[framework],
})

if (p.isCancel(template)) {
	process.exit(1);
}

let writtenPaths = await create(cwd, {
	name: path.basename(path.resolve(cwd)),
	template: template,
}).catch((err) => {
	console.error("Error writing files:", err);
	process.exit(1);
});

p.outro("Your project is ready!");

for (const path of writtenPaths) {
  console.log(`  ${bold(path)}`);
}

console.log("\nNext steps:");
let i = 1;

const relative = path.relative(process.cwd(), cwd);
if (relative !== "") {
	console.log(`  ${i++}: ${bold(cyan(`cd ${relative}`))}`);
}

// prettier-ignore
console.log(
	`  ${i++}: ${
		bold(cyan('git init && git add -A && git commit -m "Initial commit"'))
	} (optional)`,
);

console.log(`  ${i++}: ${bold(cyan("cd js"))}`);
console.log(`  ${i++}: ${bold(cyan("npm install"))} (or pnpm install, etc)`);

console.log(`  ${i++}: ${bold(cyan("npm run dev"))}`);
console.log(`\nTo close the dev server, hit ${bold(cyan("Ctrl-C"))}`);
console.log(
	`\nStuck? Visit us at ${cyan("https://github.com/manzt/anywidget")}`,
);
