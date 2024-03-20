import * as path from "@std/path";

// Adapted from https://github.com/nteract/jupyter-paths/blob/main/index.js#L175

/**
 * Guesses the sys.prefix for the current Python installation.
 *
 * Looks for a python executable in the PATH, and uses the directory.
 */
async function guess_sys_prefix(): Promise<string | undefined> {
	let dirs = (Deno.env.get("PATH") ?? "").split(":");
	let pathext = Deno.build.os === "windows"
		? (Deno.env.get("PATHEXT") ?? "").split(";")
		: [""];
	for (let dir of dirs) {
		for (let ext of pathext) {
			let bin = path.join(dir, `python${ext}`);
			let stat = await Deno.stat(bin).catch(() => {});
			if (stat?.isFile) {
				return Deno.realPath(
					Deno.build.os === "windows"
						? path.dirname(bin)
						: path.dirname(path.dirname(bin)),
				);
			}
		}
	}
}

/**
 * Get the user data directory for Jupyter.
 *
 * We could use https://deno.land/x/dir@1.5.1, but it seems
 * Jupyter paths are a little different.
 *
 * @ref https://test-jupyter.readthedocs.io/en/rtd-theme/projects/system.html#data-files
 */
export function user_data_dir(): string {
	if (Deno.build.os === "windows") {
		return path.resolve(Deno.env.get("APPDATA")!, "jupyter");
	}
	if (Deno.build.os === "darwin") {
		return path.resolve(Deno.env.get("HOME")!, "Library", "Jupyter");
	}
	let home = Deno.env.get("XDG_DATA_HOME") ?? Deno.env.get("HOME");
	return path.resolve(home!, ".local", "share", "jupyter");
}

/**
 * Get the system data directory for Jupyter.
 *
 * @ref https://test-jupyter.readthedocs.io/en/rtd-theme/projects/system.html#data-files
 */
export function system_data_dirs(): Array<string> {
	if (Deno.build.os === "windows") {
		return [path.resolve(Deno.env.get("PROGRAMDATA")!, "jupyter")];
	}
	return [
		"/usr/local/share/jupyter",
		"/usr/share/jupyter",
	];
}

/**
 * Finds a data directory to install anywidget assets into.
 *
 * @ref https://test-jupyter.readthedocs.io/en/rtd-theme/projects/system.html#data-files
 *
 * Logic is as follows:
 * 1. If we can determine the sys.prefix, use that.
 * 2. Otherwise, use the user data directory.
 * 3. Otherwise, use the system data directory.
 */
export async function find_data_dir(): Promise<string> {
	let sys_prefix = await guess_sys_prefix();
	if (sys_prefix) {
		return path.resolve(sys_prefix, "share", "jupyter");
	}
	let user_dir = user_data_dir();
	try {
		let stat = await Deno.stat(user_dir);
		if (stat.isDirectory) {
			return user_dir;
		}
	} catch {
		// Fine, we'll use the system data directory.
	}
	return system_data_dirs()[0];
}
