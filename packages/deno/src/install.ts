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

import * as cli from "@std/cli";
import * as fs from "@std/fs";
import * as path from "@std/path";
import * as unzipit from "unzipit";
import * as z from "zod";

import { findDataDir, systemDataDirs, userDataDir } from "./jupyter-paths.ts";

let ReleaseSchema = z.object({
  packagetype: z.string(),
  url: z.string(),
});

let PackageSchema = z.object({
  info: z.object({ version: z.string() }),
  releases: z.record(z.array(ReleaseSchema)),
  urls: z.array(ReleaseSchema),
});

async function fetchPackageInfo(name: string) {
  let response = await fetch(`https://pypi.org/pypi/${name}/json`);
  let json = await response.json();
  return PackageSchema.parse(json);
}

async function fetchWheel(
  info: z.infer<typeof PackageSchema>,
  version?: string,
): Promise<{ version: string; wheel: unzipit.ZipInfo }> {
  let release = version ? info.releases[version] : info.urls;
  if (!release) {
    console.log(`No entries found for version ${version}`);
    Deno.exit(1);
  }
  let wheel = release.find((e) => e.packagetype === "bdist_wheel");
  if (!wheel) {
    console.log(`No wheel found for version ${version}`);
    Deno.exit(1);
  }
  return {
    version: version ?? info.info.version,
    wheel: await unzipit.unzip(wheel.url),
  };
}

function extractDataFiles(zip: unzipit.ZipInfo): Promise<[string, Uint8Array][]> {
  let dataPrefix = /^.*\.data\/data\/share\/jupyter\//;
  return Promise.all(
    Object.entries(zip.entries)
      .filter(([name]) => dataPrefix.test(name))
      .map(async ([name, reader]) => {
        return [name.replace(dataPrefix, ""), new Uint8Array(await reader.arrayBuffer())];
      }),
  );
}

async function writeFiles(files: [string, Uint8Array][], outDir: string) {
  for (let [dataFilePath, bytes] of files) {
    let filePath = path.resolve(outDir, dataFilePath);
    await fs.ensureFile(filePath);
    await Deno.writeFile(filePath, bytes);
  }
}

async function hasJupyterWidgets() {
  for (let dir of [outDir, userDataDir(), ...systemDataDirs()]) {
    let contains = await Deno.stat(path.resolve(dir, "@jupyter-widgets"))
      .then((stat) => stat.isDirectory)
      .catch(() => false);
    if (contains) {
      return true;
    }
  }
  return false;
}

let args = cli.parseArgs(Deno.args);
let outDir = await findDataDir();

{
  let info = await fetchPackageInfo("anywidget");
  let { version, wheel } = await fetchWheel(info, args.version);
  let dataFiles = await extractDataFiles(wheel);
  await writeFiles(dataFiles, outDir);
  console.log(`✅ Installed anywidget ${version} in ${outDir}`);
}

if (!(await hasJupyterWidgets())) {
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
  let info = await fetchPackageInfo("jupyterlab_widgets");
  let { version, wheel } = await fetchWheel(info);
  let dataFiles = await extractDataFiles(wheel);
  await writeFiles(dataFiles, outDir);
  console.log(`✅ Installed jupyterlab_widgets ${version} in ${outDir}`);
}
