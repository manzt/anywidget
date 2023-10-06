import * as path from "https://deno.land/std@0.203.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.203.0/fs/mod.ts";
import * as flags from "https://deno.land/std@0.203.0/flags/mod.ts";
import * as unzipit from "npm:unzipit@1.4";
import * as z from "npm:zod@3.9";
import { find_data_dir } from "./jupyter_paths.ts";

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
): Promise<{ version: string; wheel: Uint8Array }> {
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
	let response = await fetch(wheel.url);
	return {
		version: version ?? info.info.version,
		wheel: new Uint8Array(await response.arrayBuffer()),
	};
}

async function extract_data_files(
	wheel: ArrayBuffer,
): Promise<[string, Uint8Array][]> {
	let archive = await unzipit.unzip(wheel);
	let data_prefix = /^.*\.data\/data\/share\/jupyter\//;
	return Promise.all(
		Object
			.entries(archive.entries)
			.filter(([name]) => data_prefix.test(name))
			.map(async ([name, reader]) => {
				return [
					name.replace(data_prefix, ""),
					new Uint8Array(await reader.arrayBuffer()),
				];
			}),
	);
}

let args = flags.parse(Deno.args, { string: ["version", "venv"] });
let info = await fetch_package_info("anywidget");
let { version, wheel } = await fetch_wheel(info, args.version);
let out_dir = await find_data_dir();

let files = [];
for (let [data_file_path, bytes] of await extract_data_files(wheel)) {
	let file_path = path.resolve(out_dir, data_file_path);
	await fs.ensureFile(file_path);
	await Deno.writeFile(file_path, bytes);
	files.push(file_path);
}

console.log(files.join("\n"));

console.log(`✅ Installed anywidget ${version} in ${out_dir}`);
console.log(path.join(out_dir, "labextensions/anywidget/"));
console.log(path.join(out_dir, "nbextensions/anywidget/"));
