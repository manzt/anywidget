import * as CONFIG from "./config";

export function getTitle(frontmatter: { title?: string } = {}) {
	return frontmatter?.title ?? CONFIG.SITE.title;
}
