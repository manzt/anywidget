import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Loader, LoaderContext } from "astro/loaders";

import { isNotebook, notebookToMarkdown } from "./notebook";

type NotebookLoaderOptions = {
  base: string;
};

async function notebookFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? notebookFiles(path) : [path];
    }),
  );
  return files.flat().filter((path) => path.endsWith(".ipynb"));
}

function entryId(filePath: string, basePath: string): string {
  return relative(basePath, filePath).slice(0, -".ipynb".length).split(sep).join("/");
}

function isOutside(directory: string, filePath: string): boolean {
  const path = relative(directory, filePath);
  return path === ".." || path.startsWith(`..${sep}`);
}

async function syncNotebook(
  filePath: string,
  basePath: string,
  rootPath: string,
  context: LoaderContext,
): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isNotebook(parsed)) throw new Error(`Invalid notebook: ${filePath}`);
  const notebook = parsed;
  const id = entryId(filePath, basePath);
  const sourcePath = relative(rootPath, filePath).split(sep).join("/");
  const body = notebookToMarkdown(notebook);
  const rendered = await context.renderMarkdown(body, { fileURL: pathToFileURL(filePath) });
  const frontmatter = rendered.metadata?.frontmatter ?? {};
  const data = await context.parseData({
    id,
    filePath: sourcePath,
    data: { ...frontmatter, sourcePath },
  });

  context.store.set({
    id,
    data,
    body,
    filePath: sourcePath,
    rendered,
    digest: context.generateDigest(raw),
  });
}

export function notebookLoader(options: NotebookLoaderOptions): Loader {
  return {
    name: "anywidget-notebooks",
    async load(context) {
      const rootPath = fileURLToPath(context.config.root);
      const basePath = resolve(rootPath, options.base);
      context.store.clear();
      await Promise.all(
        (await notebookFiles(basePath)).map((filePath) =>
          syncNotebook(filePath, basePath, rootPath, context),
        ),
      );

      if (!context.watcher) return;
      context.watcher.add(basePath);
      const reload = (filePath: string) => {
        if (!filePath.endsWith(".ipynb")) return;
        const absolutePath = resolve(filePath);
        if (isOutside(basePath, absolutePath)) return;
        void syncNotebook(absolutePath, basePath, rootPath, context).catch((error: unknown) => {
          context.logger.error(error instanceof Error ? error.message : String(error));
        });
      };
      context.watcher.on("add", reload);
      context.watcher.on("change", reload);
      context.watcher.on("unlink", (filePath) => {
        if (!filePath.endsWith(".ipynb")) return;
        const absolutePath = resolve(filePath);
        if (isOutside(basePath, absolutePath)) return;
        context.store.delete(entryId(absolutePath, basePath));
      });
    },
  };
}
