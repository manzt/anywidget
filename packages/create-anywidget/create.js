import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import snakecase from "just-snake-case";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {any} obj */
function json_dumps(obj) {
	return JSON.stringify(obj, null, "\t");
}

/** @param {string} name */
let pyproject_toml = (name) =>
	`\
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "${name}"
version = "0.0.0"
dependencies = ["anywidget"]

[project.optional-dependencies]
dev = ["watchfiles", "jupyterlab"]

# automatically add the dev feature to the default env (e.g., hatch shell)
[tool.hatch.envs.default]
features = ["dev"]
`;

/** @param {string} name */
let pyproject_toml_with_hatch_jupyter_builder = (name) =>
	pyproject_toml(name) + `\n
[tool.hatch.build]
artifacts = ["src/${name}/static/*"]

[tool.hatch.build.hooks.jupyter-builder]
build-function = "hatch_jupyter_builder.npm_builder"
ensured-targets = ["src/${name}/static/widget.js"]
skip-if-exists = ["src/${name}/static/widget.js"]
dependencies = ["hatch-jupyter-builder>=0.5.0"]

[tool.hatch.build.hooks.jupyter-builder.build-kwargs]
npm = "npm"
build_cmd = "build"
path = "js"
`;

/** @param {string} name */
let __init__ = (name) =>
	`\
import importlib.metadata
import pathlib

import anywidget
import traitlets

try:
    __version__ = importlib.metadata.version("${name}")
except importlib.metadata.PackageNotFoundError:
    __version__ = "unknown"


class Counter(anywidget.AnyWidget):
    _esm = pathlib.Path(__file__).parent / "static" / "widget.js"
    _css = pathlib.Path(__file__).parent / "static" / "widget.css"
    value = traitlets.Int(0).tag(sync=True)
`;

/** @param {string[]} extras */
let gitignore = (extras = []) =>
	`\
node_modules
dist

# Python
__pycache__
.ipynb_checkpoints

${extras.join("\n")}
`;

/** @param {string} name */
let readme = (name) =>
	`\
# ${name}

\`\`\`sh
pip install ${name}
\`\`\`
`;

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
	return json_dumps({
		"include": ["js"],
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
	});
}

const esbuild_templates = {
	"template-react": {
		entry_point: "js/widget.jsx",
		files: [
			{ path: "js/widget.jsx", render: widget_react },
			{ path: "js/styles.css", render: styles },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: [],
	},
	"template-react-ts": {
		entry_point: "js/widget.tsx",
		files: [
			{ path: "js/widget.tsx", render: widget_react_ts },
			{ path: "js/styles.css", render: styles },
			{ path: "tsconfig.json", render: get_tsconfig },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: ["@types/react", "@types/react-dom", "typescript"],
	},
	"template-vanilla": {
		entry_point: "js/widget.js",
		files: [
			{ path: "js/widget.js", render: widget_vanilla },
			{ path: "js/styles.css", render: styles },
		],
		dependencies: [],
		dev_dependencies: [],
	},
	"template-vanilla-ts": {
		entry_point: "js/widget.ts",
		files: [
			{ path: "js/widget.ts", render: widget_vanilla_ts },
			{ path: "js/styles.css", render: styles },
			{ path: "tsconfig.json", render: get_tsconfig },
		],
		dependencies: [],
		dev_dependencies: ["@anywidget/types", "typescript"],
	},
};

/**
 * @param {keyof esbuild_templates} type
 * @param {string} name
 */
async function gather_esbuild_template_files(type, name) {
	let template = esbuild_templates[type];
	let build_dir = `src/${name}/static`;
	let rook_pkg = await fs.readFile(
		path.join(__dirname, "package.json"),
		"utf-8",
	).then(JSON.parse);

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
			let version = rook_pkg.devDependencies[name];
			if (!version) {
				throw new Error(
					`No version found for ${name}. Must add to create-anywidget/package.json.`,
				);
			}
			deps[name] = version;
		}
		return deps;
	}
	let ts_config_path = template.files.find((file) =>
		file.path.includes("tsconfig.json")
	)?.path;
	let package_json = {
		scripts: {
			dev: "npm run build -- --sourcemap=inline --watch",
			build:
				`esbuild --minify --format=esm --bundle --outdir=${build_dir} ${template.entry_point}`,
			...(ts_config_path
				? { typecheck: `tsc --noEmit` }
				: {}),
		},
		dependencies: gather_dependencies(template.dependencies),
		devDependencies: {
			"esbuild": rook_pkg.devDependencies.esbuild,
			...gather_dependencies(template.dev_dependencies),
		},
	};
	return [
		{ path: `README.md`, content: readme(name) },
		{ path: `.gitignore`, content: gitignore([`src/${name}/static`]) },
		{ path: `package.json`, content: json_dumps(package_json) },
		{
			path: `pyproject.toml`,
			content: pyproject_toml_with_hatch_jupyter_builder(name),
		},
		{ path: `src/${name}/__init__.py`, content: __init__(name) },
		...template.files.map((file) => ({
			path: file.path,
			content: file.render(name),
		})),
	];
}

let deno_json = {
	"lock": false,
	"compilerOptions": {
		"checkJs": true,
		"allowJs": true,
		"lib": ["ES2020", "DOM", "DOM.Iterable"],
	},
	"fmt": {
		"useTabs": true,
	},
	"lint": {
		"rules": {
			"exclude": ["prefer-const"],
		},
	},
};

/** @param {string} name */
let widget_esm = (name) =>
	`\
import confetti from "https://esm.sh/canvas-confetti@1.6.0";

/** @typedef {{ value: number }} Model */

/** @type {import("npm:@anywidget/types").Render<Model>} */
export function render({ model, el }) {
	let btn = document.createElement("button");
	btn.classList.add("${name}-counter-button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		confetti();
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.appendChild(btn);
}
`;

/**
 * @param {keyof esbuild_templates | "template-vanilla-deno-jsdoc"} type
 * @param {string} name
 */
export async function gather_files(type, name) {
	if (type === "template-vanilla-deno-jsdoc") {
		return [
			{ path: `README.md`, content: readme(name) },
			{ path: `pyproject.toml`, content: pyproject_toml(name) },
			{ path: `deno.json`, content: json_dumps(deno_json) },
			{ path: `.gitignore`, content: gitignore() },
			{ path: `src/${name}/__init__.py`, content: __init__(name) },
			{ path: `src/${name}/static/widget.js`, content: widget_esm(name) },
			{ path: `src/${name}/static/styles.css`, content: styles(name) },
		];
	}
	return gather_esbuild_template_files(type, name);
}

/** @typedef {{ content: string, path: string }} File */
/** @typedef {keyof esbuild_templates | "template-vanilla-deno-jsdoc"} TemplateType */

/**
 * @param {string} target
 * @param {{ name: string, template: TemplateType }} options
 */
export async function create(target, options) {
	const files = await gather_files(options.template, snakecase(options.name));
	const promises = files.map(async (file) => {
		let location = path.resolve(target, file.path);
		await fs.mkdir(path.dirname(location), { recursive: true });
		await fs.writeFile(location, file.content, "utf-8");
	});
	await Promise.all(promises);
	return Object.keys(files);
}
