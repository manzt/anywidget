# @anywidget/deno

[anywidget](https://anywidget.dev) for the Deno Jupyter kernel.

## Usage

`In[1]:`

```typescript
import { widget } from "jsr:@anywidget/deno";

const model = widget({
	state: { letters: "abcd" },
	imports: `import * as d3 from "https://esm.sh/d3";`,
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

## Installing the anywidget front end

The above code should "just work" in VS Code. However, JupyterLab requires
manual installation of anywidget front end. This can be accomplished either by
installing the Python package into the virtual environment with Jupyter,

```sh
pip install anywidget
```

or with Deno,

```sh
deno run jsr:@anywidget/deno/install
```

You can uninstall the assets with:

```sh
deno run jsr:@anywidget/deno/uninstall
```
