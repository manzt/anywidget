// @ts-expect-error
import { parse, stringify } from "jsr:@std/yaml";

let [frontMatter, raw] = Deno.readTextFileSync("paper.md")
	.replace("---", "")
	.split("---");

let data = parse(frontMatter);
// biome-ignore lint/performance/noDelete: <explanation>
delete data["affiliations"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["authors"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["tags"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["date"];

let markdown = raw
	// Replace markdown images with myst images
	.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt: string, filepath: string) => {
		let [content, labelPart] = alt.split("\\label{");
		let label = labelPart.split("}")[0];
		return `\n
:::{figure} ${filepath}
:label: ${label}
${content}
:::
`;
	})
	.replace(/\\autoref{(.*?)}/g, "[@$1]")
	.replace(/(\[@.*?\])(\w)/g, "$1 $2")
	.replace("# Summary", "# General Summary")
	.replace("# Overview", "# Project Overview");

Deno.writeTextFileSync(
	"main.md",
	`\
---
${stringify(data)}
---
${markdown}`,
);
