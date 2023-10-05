import * as path from "https://deno.land/std@0.203.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.203.0/fs/mod.ts";
import * as flags from "https://deno.land/std@0.203.0/flags/mod.ts";
import * as unzipit from "npm:unzipit@1.4.3";

type PkgInfoEntry = {
	packagetype: string;
	url: string;
};

type PkgInfo = {
	info: { version: string };
	releases: Record<string, PkgInfoEntry[]>;
	urls: PkgInfoEntry[];
};

let { version, venv } = flags.parse(Deno.args, {
	string: ["version", "venv"],
});
let pkg_info: PkgInfo = await fetch("https://pypi.org/pypi/anywidget/json")
	.then((r) => r.json());

let info: PkgInfoEntry[];
if (version === undefined) {
	version = pkg_info.info.version;
	info = pkg_info.urls;
} else {
	info = pkg_info.releases[version];
}

if (!info) {
	console.log("No entries found for version " + version);
	Deno.exit(1);
}

let wheel = info.find((e) => e.packagetype == "bdist_wheel");

if (!wheel) {
	console.log("No wheel found for version " + version);
	Deno.exit(1);
}

let archive = await unzipit.unzip(wheel.url);
let prefix_regex = new RegExp("^anywidget-" + version + ".data/data/");
let out_dir = path.resolve(venv ?? Deno.env.get("VIRTUAL_ENV") ?? "/usr/local");

let files = [];
for (let [name, reader] of Object.entries(archive.entries)) {
	if (!prefix_regex.test(name)) continue;
	let file_path = path.resolve(out_dir, name.replace(prefix_regex, ""));
	await fs.ensureFile(file_path);
	await Deno.writeFile(
		file_path,
		new Uint8Array(await reader.arrayBuffer()),
	);
	files.push(file_path);
}
console.log(`✅ Installed anywidget ${version} in ${out_dir}`);
console.log(path.join(out_dir, "share/jupyter/labextensions/anywidget/"));
console.log(path.join(out_dir, "share/jupyter/nbextensions/anywidget/"));
console.log(path.join(out_dir, "etc/jupyter/nbconfig/notebook.d/anywidget.json"));
