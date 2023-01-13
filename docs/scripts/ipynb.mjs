// @ts-check
import * as child_process from "node:child_process";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";

import { renderMarkdown } from "@astrojs/markdown-remark";
import matter from "gray-matter";
import { normalizePath } from "vite";
import { fileURLToPath } from "node:url";

/**
 * @typedef CellOutput
 * @prop {"execute_result"} output_type
 * @prop {{ "text/plain"?: string, "application/vnd.jupyter.widget-view+json"?:  { version_major: number, version_minor: number, model_id: string }}} data
 */

/**
 * @typedef CodeCell
 * @prop {"code"} cell_type
 * @prop {string | string[]} source
 * @prop {CellOutput[]} outputs
 */

/**
 * @typedef MarkdownCell
 * @prop {"markdown"} cell_type
 * @prop {string | string[]} source
 */

/**
 * @typedef RawCell
 * @prop {"raw"} cell_type
 * @prop {string | string[]} source
 */

/** @typedef {MarkdownCell | RawCell | CodeCell} Cell */

/**
 * @typedef Widget
 * @prop {string} id
 */

/**
 * @typedef JupyterNotebook
 * @prop {Cell[]} cells
 * @prop {{ widgets: Record<"application/vnd.jupyter.widget-state+json", any>}} metadata
 */

/**
 * @param {string} code
 * @param {string} id
 * @see https://github.com/withastro/astro/blob/c53b1fca073136e1e1a6f5d0b32d7c023e98c675/packages/integrations/mdx/src/utils.ts#L45-L63
 */
export function parseFrontmatter(code, id) {
	try {
		return matter(code);
	} catch (e) {
		if (e.name === "YAMLException") {
			/** @type {import('astro').SSRError} */
			const err = e;
			err.id = id;
			err.loc = { file: e.id, line: e.mark.line + 1, column: e.mark.column };
			err.message = e.reason;
			throw err;
		} else {
			throw e;
		}
	}
}

/** @param {string} path */
function appendForwardSlash(path) {
	return path.endsWith("/") ? path : path + "/";
}

/**
 * @param {string} id
 * @param {import('astro').AstroConfig} config
 * @returns {{ fileId: string, fileUrl: string}}
 */
export function getFileInfo(id, config) {
	const sitePathname = appendForwardSlash(
		config.site ? new URL(config.base, config.site).pathname : config.base
	);

	// Try to grab the file's actual URL
	/** @type {URL | undefined} */
	let url = undefined;
	try {
		url = new URL(`file://${id}`);
	} catch {}

	const fileId = id.split("?")[0];
	/** @type {string} */
	let fileUrl;
	const isPage = fileId.includes("/pages/");
	if (isPage) {
		fileUrl = fileId
			.replace(/^.*?\/pages\//, sitePathname)
			.replace(/(\/index)?\.mdx$/, "");
	} else if (url && url.pathname.startsWith(config.root.pathname)) {
		fileUrl = url.pathname.slice(config.root.pathname.length);
	} else {
		fileUrl = fileId;
	}

	if (fileUrl && config.trailingSlash === "always") {
		fileUrl = appendForwardSlash(fileUrl);
	}
	return { fileId, fileUrl };
}

/**
 * @param {string} fileId
 * @returns {Promise<JupyterNotebook>}
 */
async function executeAndReadNotebookFromStdout(fileId) {
	let file = fileURLToPath(new URL("./render.py", import.meta.url));
	return new Promise((resolve, reject) => {
		child_process.execFile(file, [fileId], (err, stdout) => {
			if (err) {
				reject(err);
			} else {
				resolve(JSON.parse(stdout));
			}
		});
	});
}

/**
 * @param {string} fileId
 * @param {boolean} execute
 * @returns {Promise<JupyterNotebook>}
 */
async function readNotebook(fileId, execute = false) {
	if (execute) return executeAndReadNotebookFromStdout(fileId);
	return fs.readFile(fileId, { encoding: "utf-8" }).then(JSON.parse);
}

// absolute path of "astro/jsx-runtime"
const astroJsxRuntimeModulePath = normalizePath(
	fileURLToPath(
		new URL("../node_modules/astro/dist/jsx-runtime/index.js", import.meta.url)
	)
);

/** @param {Cell | undefined} cell */
function extractCellSource(cell) {
	if (!cell) return "";
	return Array.isArray(cell.source) ? cell.source.join("") : cell.source;
}

/** @param {Cell} cell */
function extractMarkdownContent(cell) {
	let source = extractCellSource(cell);
	if (cell.cell_type == "markdown") return source;
	if (cell.cell_type == "raw") return `\`\`\`\n${source}\n\`\`\`\n`;
	return `\`\`\`python\n${source}\n\`\`\`\n`;
}

/**
 * @param {JupyterNotebook} nb
 * @param {{ fileId: string, config: import('astro').AstroConfig, frontmatter: Record<string, any> }} options
 */
async function renderCellsMarkdown(nb, options) {
	/** @param {string} content */
	function _renderMarkdown(content) {
		return renderMarkdown(content, {
			...options.config.markdown,
			fileURL: new URL(`file://${options.fileId}`),
			contentDir: new URL("./content/", options.config.srcDir),
			// @ts-expect-error
			frontmatter: options.frontmatter,
		});
	}
	let raw = "",
		html = "";
	let headings;

	for (let cell of nb.cells) {
		let content = extractMarkdownContent(cell);
		let renderResult = await _renderMarkdown(content);
		if (!headings) headings = renderResult.metadata.headings;
		raw += content;
		html += renderResult.code;

		if (cell.cell_type === "code") {
			for (let output of cell.outputs) {
				let wdata = output.data["application/vnd.jupyter.widget-view+json"];
				if (
					wdata &&
					wdata.model_id in
						nb.metadata?.widgets?.["application/vnd.jupyter.widget-state+json"]
							.state
				) {
					let uuid = crypto.randomUUID();
					html += `\
					<div id="${uuid}" class="jupyter-widgets jp-OutputArea-output jp-OutputArea-executeResult">
						<script type="text/javascript">
							var element = document.getElementById('${uuid}');
						</script>
						<script type="application/vnd.jupyter.widget-view+json">
							${JSON.stringify(output.data["application/vnd.jupyter.widget-view+json"])}
						</script>
					</div>
					`;
				} else if (output.data["text/plain"]) {
					html += `<pre>${output.data["text/plain"]}</pre>`;
				}
			}
		}
	}
	return { raw, html, headings };
}

/**
 * @param {{ execute?: boolean, config: import("astro").AstroConfig }} options
 * @returns {import('vite').Plugin}
 */
function vitePlugin(options) {
	return {
		name: "ipynb",
		enforce: "pre",
		async transform(_, id) {
			if (!id.endsWith("ipynb")) return;
			let { fileId, fileUrl } = getFileInfo(id, options.config);
			let nb = await readNotebook(fileId, options.execute);

			let frontmatter = {};
			if (nb.cells[0].cell_type == "raw") {
				let rawSource = extractCellSource(nb.cells.shift());
				frontmatter = parseFrontmatter(rawSource, id).data;
			}

			let { raw, html, headings } = await renderCellsMarkdown(nb, {
				fileId,
				frontmatter,
				config: options.config,
			});

			html =
				`\
<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js"></script>
<script src="https://unpkg.com/@jupyter-widgets/html-manager@*/dist/embed-amd.js"></script>\n
<script type="application/vnd.jupyter.widget-state+json">
	${JSON.stringify(
		nb.metadata.widgets["application/vnd.jupyter.widget-state+json"]
	)}
</script>\n` + html;

			let { layout } = frontmatter;

			// adapted from https://github.com/withastro/astro/blob/main/packages/astro/src/vite-plugin-markdown/index.ts
			// deno-fmt-ignore
			let code = `
				import { Fragment, jsx as h } from ${JSON.stringify(astroJsxRuntimeModulePath)};
				${layout ? `import Layout from ${JSON.stringify(layout)};` : ""}
				const html = ${JSON.stringify(html)};
				export const frontmatter = ${JSON.stringify(frontmatter)};
				export const file = ${JSON.stringify(fileId)};
				export const url = ${JSON.stringify(fileUrl)};
				export function rawContent() {
					return ${JSON.stringify(raw)};
				}
				export function compiledContent() {
					return html;
				}
				export function getHeadings() {
					return ${JSON.stringify(headings)};
				}
				export async function Content() {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;
					content.astro = {};
					const contentFragment = h(Fragment, { 'set:html': html });
					return ${
						layout
							? `h(Layout, {
						file,
						url,
						content,
						frontmatter: content,
						headings: getHeadings(),
						rawContent,
						compiledContent,
						'server:root': true,
						children: contentFragment
					})`
							: `contentFragment`
					};
				}
				Content[Symbol.for('astro.needsHeadRendering')] = ${layout ? "false" : "true"};
				export default Content;
			`;
			return {
				code,
				meta: {
					astro: {
						hydratedComponents: [],
						clientOnlyComponents: [],
						scripts: [],
						propagation: "none",
						pageOptions: {},
					},
					vite: {
						lang: "ts",
					},
				},
			};
		},
	};
}

/**
 * @param {{ execute?: boolean }} opts
 * @return {import('astro').AstroIntegration}
 */
export default function ipynb({ execute } = {}) {
	return {
		name: "ipynb",
		hooks: {
			"astro:config:setup": async (options) => {
				// @ts-ignore
				options.addPageExtension(".ipynb");
				options.updateConfig({
					vite: { plugins: [vitePlugin({ execute, ...options })] },
				});
			},
		},
	};
}
