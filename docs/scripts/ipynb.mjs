// @ts-check
import * as fs from "node:fs/promises";
import * as child_process from "node:child_process";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import {
	createAstroComponentString,
	getFileInfo,
	parseFrontmatter,
} from "./utils.mjs";

let WIDGET_VIEW_MIMETYPE = /** @type {const} */ (
	"application/vnd.jupyter.widget-view+json"
);
let WIDGET_STATE_MIMETYPE = /** @type {const} */ (
	"application/vnd.jupyter.widget-state+json"
);

/**
 * @typedef CellOutput
 * @prop {"execute_result"} output_type
 * @prop {{ "text/plain"?: string, "application/vnd.jupyter.widget-view+json"?:  { version_major: number, version_minor: number, model_id: string }}} data
 */

/**
 * @typedef CodeCell
 * @prop {"code"} cell_type
 * @prop {string} id
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
 * @typedef WidgetStateData
 * @prop {number} version_major
 * @prop {number} version_minor
 * @prop {Record<string, any>} state
 */

/**
 * @typedef Widget
 * @prop {string} id
 */

/**
 * @typedef JupyterNotebook
 * @prop {Cell[]} cells
 * @prop {{ widgets?: { "application/vnd.jupyter.widget-state+json"?: WidgetStateData } }} metadata
 */

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
 * @param {CellOutput} output
 * @param {WidgetStateData | undefined} widgetState
 */
function outputHtml(output, widgetState) {
	let widgetStateIds = new Set(Object.keys(widgetState?.state ?? {}));
	let widgetData = output.data[WIDGET_VIEW_MIMETYPE];

	if (widgetData && widgetStateIds.has(widgetData.model_id)) {
		let uuid = crypto.randomUUID();
		return `\
		<div id="${uuid}" class="jupyter-widgets jp-OutputArea-output jp-OutputArea-executeResult">
			<script type="text/javascript">
				var element = document.getElementById("${uuid}");
			</script>
			<script type="application/vnd.jupyter.widget-view+json">
				${JSON.stringify(widgetData)}
			</script>
		</div>
		`;
	}

	if (output.data["text/plain"]) {
		return `<pre>${output.data["text/plain"]}</pre>`;
	}

	return "";
}

/** @param {WidgetStateData} widgetState */
function widgetClientHtml(widgetState) {
	return `\
	<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js"></script>
	<script src="https://unpkg.com/@jupyter-widgets/html-manager@*/dist/embed-amd.js"></script>\n
	<script type="application/vnd.jupyter.widget-state+json">${
		JSON.stringify(
			widgetState,
		)
	}</script>\n`;
}

/**
 * @param {JupyterNotebook} nb
 * @param {{ fileId: string, config: import('astro').AstroConfig, frontmatter: Record<string, any>, widgetState?: WidgetStateData }} options
 */
async function renderCellsMarkdown(nb, options) {
	let processor = await createMarkdownProcessor(options.config.markdown);
	/** @param {string} content */
	function _renderMarkdown(content) {
		return processor.render(content, {
			// fileURL: new URL(`file://${options.fileId}`),
			// contentDir: new URL("./content/", options.config.srcDir),
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
				html += outputHtml(output, options.widgetState);
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
			if (!id.endsWith(".ipynb")) return;
			let { fileId, fileUrl } = getFileInfo(id, options.config);

			let nb = await readNotebook(fileId, options.execute);

			let frontmatter = {};

			if (nb.cells[0].cell_type == "raw") {
				let rawSource = extractCellSource(nb.cells.shift());
				frontmatter = parseFrontmatter(rawSource, id).data;
			}

			let widgetState = nb.metadata?.widgets?.[WIDGET_STATE_MIMETYPE];

			let { raw, html, headings } = await renderCellsMarkdown(nb, {
				fileId,
				frontmatter,
				widgetState,
				config: options.config,
			});

			if (widgetState) {
				html = widgetClientHtml(widgetState) + html;
			}

			return {
				code: createAstroComponentString({
					raw,
					html,
					headings,
					frontmatter,
					fileId,
					fileUrl,
				}),
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
