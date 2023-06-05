// @ts-check
import matter from "gray-matter";

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
 * @typedef AstroComponentOptions
 * @prop {Record<string, any>=} frontmatter
 * @prop {string} fileId
 * @prop {string} fileUrl
 * @prop {string} raw
 * @prop {string} html
 * @prop {import("@astrojs/markdown-remark").MarkdownHeading[] | undefined} headings
 */

// adapted from https://github.com/withastro/astro/blob/main/packages/astro/src/vite-plugin-markdown/index.ts
/** @param {AstroComponentOptions} options */
export function createAstroComponentString({
	frontmatter = {},
	fileId,
	fileUrl,
	raw,
	headings,
	html,
}) {
	let { layout } = frontmatter;

	// deno-fmt-ignore
	return `
	import { Fragment, jsx as h } from 'astro/jsx-runtime';
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
}
