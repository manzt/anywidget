/**
 * @module
 *
 * Uninstall the front-end anywidget assets for JupyterLab.
 *
 * ```sh
 * deno run -A jsr:@anywidget/deno/uninstall
 * ```
 */

import * as path from "@std/path";

import { findDataDir } from "./jupyter-paths.ts";

let dataDir = await findDataDir();

await Deno.readTextFile(path.join(dataDir, "labextensions/anywidget/package.json"))
  .then((contents) => {
    const { version } = JSON.parse(contents);
    console.log(`Uninstalling anywidget@${version}...`);
  })
  .catch(() => {});

await Deno.remove(path.join(dataDir, "labextensions/anywidget"), {
  recursive: true,
}).catch(() => {});

await Deno.remove(path.join(dataDir, "nbextensions/anywidget"), {
  recursive: true,
}).catch(() => {});
