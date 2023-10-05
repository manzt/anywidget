# anywidget (deno)

Jupyter Widgets for Jupyter JavaScript Kernels (experimental).

## Usage

`In[1]:`

```typescript
import { widget } from "https://deno.land/x/anywidget/mod.ts";

const model = await widget({
	state: { letters: "abcd" },
	imports: `\
import * as d3 from "https://esm.sh/d3";
`,
	render: ({ model, el }) => {
		const width = 300;
		const svg = d3.create("svg")
			.attr("width", width)
			.attr("height", 33)
			.attr("viewBox", `0 -20 ${width} 33`);
		model.on("change:letters", () => {
			const t = svg.transition().duration(200);
			svg.selectAll("text")
				.data(model.get("letters"), (d) => d)
				.join(
					(enter) =>
						enter.append("text")
							.attr("fill", "green")
							.attr("x", (d, i) => i * 16)
							.attr("y", -30)
							.text((d) => d)
							.call((enter) =>
								enter.transition(t)
									.attr("y", 0)
							),
					(update) =>
						update
							.attr("fill", "black")
							.attr("y", 0)
							.call((update) =>
								update.transition(t)
									.attr("x", (d, i) => i * 16)
							),
					(exit) =>
						exit
							.attr("fill", "brown")
							.call((exit) =>
								exit.transition(t)
									.attr("y", 30)
									.remove()
							),
				);
		});
		el.appendChild(svg.node());
	},
});

model;
```

`Out[1]:`

![listing of words from /usr/share/dict/words](https://github.com/manzt/anywidget/assets/24403730/de7e84cf-91cb-4532-9850-6763ff12ea41)

`In[2]:`

```typescript
let dict = await Deno.readTextFile("/usr/share/dict/words");
for (let word of dict.split("\n")) {
	model.set("letters", word);
	await new Promise((resolve) => setTimeout(resolve, 500));
}
```
