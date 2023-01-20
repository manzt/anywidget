import * as CONFIG from "./config";

export function getTitle(frontmatter: { title?: string; url?: string } = {}) {
	let title = CONFIG.SITE.title;
	if (frontmatter?.title) {
		let isBlog = frontmatter?.url?.startsWith("/blog/");
		title = isBlog ? frontmatter.title : `${frontmatter.title} | ${title}`;
	}
	return title;
}
