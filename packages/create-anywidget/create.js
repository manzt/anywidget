// @ts-check
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {string} root */
async function *walk(root) {
	for (let entry of await fs.readdir(root, { withFileTypes: true })) {
		if (entry.isFile()) {
			yield {
				type: "file",
				path: path.resolve(root, entry.name)
			}
		} else if (entry.isDirectory()) {
			yield {
				type: "directory",
				path: path.resolve(root, entry.name)
			}
			yield *walk(path.resolve(root, entry.name));
		} else {
			throw Error("unknown type");
		}
	}
}

/**
 * @param {string} target
 * @param {Record<string, any>} options
 */
async function create(target, options) {

	await fs.cp(path.resolve(__dirname, options.template), target, {
		recursive: true,
	});

	for await (let item of walk(path.resolve(__dirname, options.template))) {
		console.log(item);
	}
}

let cwd = process.argv[2];
create(cwd, { name: path.basename(cwd), template: "template-react" });
