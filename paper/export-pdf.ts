// deno run -A export-pdf.ts [output.pdf]

// @ts-expect-error
import { parse, stringify } from "jsr:@std/yaml";

let [frontMatter, raw] = Deno.readTextFileSync("paper.md")
	.replace("---", "")
	.split("---");

let output = Deno.args[0] || "dist/paper.pdf";

let data = parse(frontMatter);
// biome-ignore lint/performance/noDelete: <explanation>
delete data["affiliations"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["authors"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["tags"];
// biome-ignore lint/performance/noDelete: <explanation>
delete data["date"];

data["exports"] = {
	format: "typst",
	template: "lapreprint-typst",
	output: output,
};

data["margin"] = [
	{
		title: "Correspondence to",
		content: "Correspondence: [author-email]",
	},
];
data["abstract"] = `\
The anywidget project provides a specification and toolset for creating
portable web-based widgets for computational notebooks. It defines a standard
for front-end widget code using ECMAScript modules and offers tools for
authoring, distributing, and executing these modules across Jupyter-compatible
platforms (e.g., JupyterLab, Google Colab, VS Code). The project has spurred
the creation of many interactive visualization libraries and has been
integrated into existing ones. The standard has been embraced by other
notebook platforms and web frameworks, extending the reach of interactive
widgets beyond the Jupyter ecosystem.`.trim();

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
	"tmp.md",
	`\
---
${stringify(data)}
---
${markdown}`,
);

new Deno.Command("myst", { args: ["build", "--pdf", "tmp.md"] })
	.output()
	.then((data) => {
		console.log(`PDF saved to ${output}`);
	})
	.catch(console.error)
	.finally(async () => {
		await Deno.remove("tmp.md");
	});
