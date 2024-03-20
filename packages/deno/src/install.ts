/**
 * @module
 * Install the front-end anywidget assets for JupyterLab.
 *
 * Requires read and write privileges to the Jupyter data directories.
 *
 * ```sh
 * deno run -A jsr:@anywidget/deno/install
 * ```
 */

import * as path from "@std/path";
import * as fs from "@std/fs";
import * as cli from "@std/cli";
import * as unzipit from "unzipit";
import * as z from "zod";
import {
	find_data_dir,
	system_data_dirs,
	user_data_dir,
} from "./jupyter_paths.ts";

let ReleaseSchema = z.object({
	packagetype: z.string(),
	url: z.string(),
});

let PackageSchema = z.object({
	info: z.object({ version: z.string() }),
	releases: z.record(z.array(ReleaseSchema)),
	urls: z.array(ReleaseSchema),
});

async function fetch_package_info(name: string) {
	let response = await fetch(`https://pypi.org/pypi/${name}/json`);
	let json = await response.json();
	return PackageSchema.parse(json);
}

async function fetch_wheel(
	info: z.infer<typeof PackageSchema>,
	version?: string,
): Promise<{ version: string; wheel: unzipit.ZipInfo }> {
	let release = version ? info.releases[version] : info.urls;
	if (!release) {
		console.log(`No entries found for version ${version}`);
		Deno.exit(1);
	}
	let wheel = release.find((e) => e.packagetype == "bdist_wheel");
	if (!wheel) {
		console.log(`No wheel found for version ${version}`);
		Deno.exit(1);
	}
	return {
		version: version ?? info.info.version,
		wheel: await unzipit.unzip(wheel.url),
	};
}

function extract_data_files(
	zip: unzipit.ZipInfo,
): Promise<[string, Uint8Array][]> {
	let data_prefix = /^.*\.data\/data\/share\/jupyter\//;
	return Promise.all(
		Object
			.entries(zip.entries)
			.filter(([name]) => data_prefix.test(name))
			.map(async ([name, reader]) => {
				return [
					name.replace(data_prefix, ""),
					new Uint8Array(await reader.arrayBuffer()),
				];
			}),
	);
}

async function write_files(
	files: [string, Uint8Array][],
	out_dir: string,
) {
	for (let [data_file_path, bytes] of files) {
		let file_path = path.resolve(out_dir, data_file_path);
		await fs.ensureFile(file_path);
		await Deno.writeFile(file_path, bytes);
	}
}

async function has_jupyter_widgets() {
	for (let dir of [out_dir, user_data_dir(), ...system_data_dirs()]) {
		let contains = await Deno
			.stat(path.resolve(dir, "@jupyter-widgets"))
			.then((stat) => stat.isDirectory)
			.catch(() => false);
		if (contains) {
			return true;
		}
	}
	return false;
}

let args = cli.parseArgs(Deno.args);
let out_dir = await find_data_dir();

{
	let info = await fetch_package_info("anywidget");
	let { version, wheel } = await fetch_wheel(info, args.version);
	let data_files = await extract_data_files(wheel);
	await write_files(data_files, out_dir);
	console.log(`✅ Installed anywidget ${version} in ${out_dir}`);
}

if (!(await has_jupyter_widgets())) {
	/**
	 * NB: The anywidget front-end code relies on @jupyter-widgets/base,
	 * which is supplied by the _python_ `jupyterlab_widgets` package.
	 *
	 * anywidget -> ipywidgets -> jupyterlab_widgets
	 *
	 * So, anywidget requires `@jupyter-widgets` in the data dirs to work.
	 * We could try to use the package metadata to find the version of
	 * `jupyterlab_widgets` that `ipywidgets` depends on, but that's a lot
	 * work.
	 *
	 * For now, we get that latest data files from `jupyterlab_widgets`
	 * if `@jupyter-widgets` is not present in any of the Jupyter data dirs.
	 */
	let info = await fetch_package_info("jupyterlab_widgets");
	let { version, wheel } = await fetch_wheel(info);
	let data_files = await extract_data_files(wheel);
	await write_files(data_files, out_dir);
	console.log(`✅ Installed jupyterlab_widgets ${version} in ${out_dir}`);
}
