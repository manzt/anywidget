import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import snakecase from "just-snake-case";

/** @typedef {{ content: string, path: string }} File */

/**
 * @param {string} target
 * @param {{ name: string, template: string }} options
 */
export async function create(target, options) {
	const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
	const copyFrom = path.resolve(__dirname, options.template);
	const copyTo = target;
	const newName = snakecase(options.name);

	const allFiles = await gatherFiles(copyFrom);
	const updatedFiles = renameGitignore(allFiles);
	const updatedContentFiles = replaceWidgetName(updatedFiles, newName);
	const updatedPathFiles = updateFilePaths(
		updatedContentFiles,
		copyFrom,
		copyTo,
		newName,
	);

	await createFiles(updatedPathFiles);
	return updatedPathFiles.map((file) => file.path);
}

/** @param {string} startDir */
async function gatherFiles(startDir) {
	/** @type {File[]} */
	const results = [];

	/** @param {string} dir */
	async function walk(dir) {
		const files = await fs.readdir(dir);
		for (const file of files) {
			const entry = path.join(dir, file);
			const stats = await fs.stat(entry);

			if (stats.isDirectory()) {
				await walk(entry);
			} else {
				const content = await fs.readFile(entry, "utf-8");
				results.push({ content, path: entry });
			}
		}
	}
	await walk(startDir);
	return results;
}

/**
 * @param {File[]} files
 * @returns {File[]}
 */
function renameGitignore(files) {
	return files.map((file) => {
		if (path.basename(file.path) === "_gitignore") {
			file.path = path.join(path.dirname(file.path), ".gitignore");
		}
		return file;
	});
}

/**
 * @param {File[]} files
 * @param {string} newName
 * @returns {File[]}
 */
function replaceWidgetName(files, newName) {
	return files.map((file) => {
		file.content = file.content.replace(/my_widget/g, newName);
		return file;
	});
}

/**
 * @param {File[]} files
 * @param {string} sourceDir
 * @param {string} destDir
 * @param {string} newName
 * @returns {File[]}
 */
function updateFilePaths(files, sourceDir, destDir, newName) {
	return files.map((file) => {
		let newPath = file.path.replace(sourceDir, destDir);

		// Check if path has the structure 'src/my_widget'
		if (newPath.includes("src/my_widget")) {
			newPath = newPath.replace(/src\/my_widget/g, "src/" + newName);
		}

		file.path = newPath;
		return file;
	});
}

/**
 * @param {File[]} files
 * @returns {Promise<void>}
 */
async function createFiles(files) {
	const writePromises = files.map(async (file) => {
		await fs.mkdir(path.dirname(file.path), { recursive: true });
		// Write (or overwrite) the file
		await fs.writeFile(file.path, file.content, "utf-8");
	});

	await Promise.all(writePromises);
}
