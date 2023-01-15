import * as CONFIG from "./config";

export function getTitle(frontmatter: { title?: string } = {}) {
	let title = CONFIG.SITE.title;
	if (frontmatter?.title) {
		title = `${frontmatter.title} | ${title}`;
	}
	return title;
}
