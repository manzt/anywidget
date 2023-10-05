import * as path from "https://deno.land/std@0.203.0/path/mod.ts";
import * as flags from "https://deno.land/std@0.203.0/flags/mod.ts";

let { venv } = flags.parse(Deno.args, {
	string: ["venv"],
});

let out_dir = venv ?? Deno.env.get("VIRTUAL_ENV") ?? "/usr/local";

await Deno.readTextFile(
	path.join(out_dir, "share/jupyter/labextensions/anywidget/package.json"),
).then((contents) => {
	const { version } = JSON.parse(contents);
	console.log(`Uninstalling anywidget@${version}...`);
}).catch(() => {});

await Deno.remove(
	path.join(out_dir, "share/jupyter/labextensions/anywidget"),
	{ recursive: true },
).catch(() => {});

await Deno.remove(
	path.join(out_dir, "share/jupyter/nbextensions/anywidget"),
	{ recursive: true },
).catch(() => {});

await Deno.remove(
	path.join(out_dir, "etc/jupyter/nbconfig/notebook.d/anywidget.json"),
).catch(() => {});
