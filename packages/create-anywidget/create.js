import * as fs from "node:fs/promises";
import * as path from "node:path";
import snakecase from "just-snake-case";

import { gather_files } from "./template.js";

/** @typedef {{ content: string, path: string }} File */

/**
 * @param {string} target
 * @param {{ name: string, template: string }} options
 */
export async function create(target, options) {
	const files = await gather_files(options.template, snakecase(options.name));
	const promises = files.map(async (file) => {
		let location = path.resolve(target, file.path);
		await fs.mkdir(path.dirname(location), { recursive: true });
		await fs.writeFile(location, file.content, "utf-8");
	});
	await Promise.all(promises);
	return Object.keys(files);
}
