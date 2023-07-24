// @ts-check
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import snakecase from "just-snake-case";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {string} root */
async function* walk(root) {
	for (let entry of await fs.readdir(root, { withFileTypes: true })) {
		if (entry.isFile()) {
			yield {
				type: "file",
				path: path.resolve(root, entry.name),
			};
		} else if (entry.isDirectory()) {
			yield {
				type: "directory",
				path: path.resolve(root, entry.name),
			};
			yield* walk(path.resolve(root, entry.name));
		} else {
			throw Error("unknown type");
		}
	}
}

/**
 * @param {string} root
 * @param {string} old_name
 * @param {string} new_name
 */
async function walk_and_rename(root, old_name, new_name) {
	let entries = await fs.readdir(root, { withFileTypes: true });
	for (let entry of entries) {
		let current_path = path.join(root, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === old_name) {
				let new_path = path.join(root, new_name);
				await fs.rename(current_path, new_path);
				current_path = new_path;
			}
			await walk_and_rename(current_path, old_name, new_name);
		} else if (entry.isFile()) {
			if (entry.name === "_gitignore") {
				let new_path = current_path.replace("_gitignore", ".gitignore");
				await fs.rename(current_path, new_path);
				current_path = new_path;
			}
			let content = await fs.readFile(current_path, "utf-8");
			content = content.replace(new RegExp(old_name, "g"), new_name);
			await fs.writeFile(current_path, content, "utf8");
		} else {
			throw Error("unknown type");
		}
	}
}

/**
 * @param {string} target
 * @param {Record<string, any>} options
 */
export async function create(target, options) {
	await fs.cp(path.resolve(__dirname, options.template), target, {
		recursive: true,
	});
	await walk_and_rename(target, "my_widget", snakecase(options.name));
}
