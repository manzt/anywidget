import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {string} name */
let styles = (name) =>
	`\
.${name}-counter-button {
	background: linear-gradient(
		300deg,
		#9933ff 33.26%,
		#ff6666 46.51%,
		#faca30 59.77%,
		#00cd99 73.03%,
		#00ccff 86.29%
	);
	border-radius: 10px;
	border: 0;
	color: white;
	cursor: pointer;
	font-family: "Roboto", sans-serif;
	font-size: 2em;
	margin: 10px;
	padding: 10px 20px;
	transition: transform 0.25s ease-in-out;
}

.${name}-counter-button:hover {
	transform: scale(1.05);
}
`;

/** @param {string} name */
let widget_react_ts = (name) =>
	`\
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./styles.css";

export const render = createRender(() => {
	const [value, setValue] = useModelState<number>("value");
	return (
		<button
			className="${name}-counter-button"
			onClick={() => setValue(value + 1)}
		>
			count is {value}
		</button>
	);
});
`;

/** @param {string} name */
let widget_react = (name) =>
	`\
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./styles.css";

export const render = createRender(() => {
	const [value, setValue] = useModelState("value");
	return (
		<button
			className="${name}-counter-button"
			onClick={() => setValue(value + 1)}
		>
			count is {value}
		</button>
	);
});
`;

/** @param {string} name */
let widget_vanilla = (name) =>
	`\
import "./styles.css";

export function render({ model, el }) {
	let btn = document.createElement("button");
	btn.classList.add("${name}-counter-button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.appendChild(btn);
}
`;

/** @param {string} name */
let widget_vanilla_ts = (name) =>
	`\
import type { RenderContext } from "@anywidget/types";
import "./styles.css";

/* Specifies attributes defined with traitlets in ../src/${name}/__init__.py */
interface WidgetModel {
	value: number;
	/* Add your own */
}

export function render({ model, el }: RenderContext<WidgetModel>) {
	let btn = document.createElement("button");
	btn.classList.add("${name}-counter-button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.appendChild(btn);
}
`;

function get_tsconfig() {
	return {
		"include": ["src"],
		"compilerOptions": {
			"target": "ES2020",
			"module": "ESNext",
			"lib": ["ES2020", "DOM", "DOM.Iterable"],
			"skipLibCheck": true,

			/* Bundler mode */
			"moduleResolution": "bundler",
			"allowImportingTsExtensions": true,
			"resolveJsonModule": true,
			"isolatedModules": true,
			"noEmit": true,
			"jsx": "react",

			/* Linting */
			"strict": true,
			"noUnusedLocals": true,
			"noUnusedParameters": true,
			"noFallthroughCasesInSwitch": true,
		},
	};
}

const esbuild_templates = {
	"template-react": {
		entry_point: "js/src/widget.jsx",
		files: [
			{ path: "js/src/widget.jsx", render: widget_react },
			{ path: "js/src/styles.css", render: styles },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: [],
	},
	"template-react-ts": {
		entry_point: "js/src/widget.tsx",
		files: [
			{ path: "js/src/widget.tsx", render: widget_react_ts },
			{ path: "js/src/styles.css", render: styles },
			{ path: "js/tsconfig.json", render: get_tsconfig },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: ["@types/react", "@types/react-dom", "typescript"],
	},
	"template-vanilla": {
		entry_point: "js/src/widget.js",
		files: [
			{ path: "js/src/widget.js", render: widget_vanilla },
			{ path: "js/src/styles.css", render: styles },
		],
		dependencies: [],
		dev_dependencies: [],
	},
	"template-vanilla-ts": {
		entry_point: "js/src/widget.ts",
		files: [
			{ path: "js/src/widget.ts", render: widget_vanilla_ts },
			{ path: "js/src/styles.css", render: styles },
			{ path: "js/tsconfig.json", render: get_tsconfig },
		],
		dependencies: [],
		dev_dependencies: ["@types/anywidget", "typescript"],
	},
};

/**
 * @param {keyof esbuild_templates} type
 * @param {string} build_dir
 * @param {string} name
 */
async function render_esbuild_template(type, build_dir, name) {
	let root_pkg_json = await fs.promises
		.readFile(path.join(__dirname, "package.json"), "utf-8")
		.then(JSON.parse);

	/**
	 * pnpm will help us keep package versions in sync over time, along with dependabot.
	 * so we lookup the version from there for any dependencies in our templates.
	 * @param {string[]} names
	 * @returns {Record<string, string>}
	 */
	function gather_dependencies(names) {
		/** @type {Record<string, string>} */
		let deps = {};
		for (let name of names) {
			let version = root_pkg_json.devDependencies[name];
			if (!version) {
				throw new Error(
					`No version found for ${name}. Must add to create-anywidget/package.json.`,
				);
			}
			deps[name] = version;
		}
		return deps;
	}

	let template = esbuild_templates[type];

	let ts_config_path = template.files.find((file) =>
		file.path.includes("tsconfig.json")
	)?.path;

	let package_json = {
		scripts: {
			dev: "npm run build -- --sourcemap=inline --watch",
			build:
				`esbuild --minify --format=esm --bundle --outdir=${build_dir} ${template.entry_point}`,
			...(ts_config_path ? { typecheck: `tsc --noEmit --project ${ts_config_path}` } : {}),
		},
		dependencies: gather_dependencies(template.dependencies),
		devDependencies: gather_dependencies(template.dev_dependencies),
	};

	let files = template.files.map((file) => ({
		path: file.path,
		content: file.render(name),
	}));

	files.push({
		path: "package.json",
		content: JSON.stringify(package_json, null, "\t"),
	});

	return files;
}

console.log(
	await render_esbuild_template(
		"template-react-ts",
		"src/my_widget/static",
		"react",
	),
);
