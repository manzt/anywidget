import * as path from "https://deno.land/std@0.203.0/path/mod.ts";
import { find_data_dir } from "./jupyter_paths.ts";

let data_dir = await find_data_dir();

await Deno.readTextFile(
	path.join(data_dir, "labextensions/anywidget/package.json"),
).then((contents) => {
	const { version } = JSON.parse(contents);
	console.log(`Uninstalling anywidget@${version}...`);
}).catch(() => {});

await Deno.remove(
	path.join(data_dir, "labextensions/anywidget"),
	{ recursive: true },
).catch(() => {});

await Deno.remove(
	path.join(data_dir, "nbextensions/anywidget"),
	{ recursive: true },
).catch(() => {});
