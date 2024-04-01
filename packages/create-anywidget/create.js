import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import snakecase from "just-snake-case";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {any} obj */
function json_dumps(obj) {
	return JSON.stringify(obj, null, "\t");
}

/** @param {string} path */
async function read_json(path) {
	return fs.readFile(path, "utf-8").then(JSON.parse);
}

/**
 * pnpm will help us keep package versions in sync over time, along with dependabot,
 * so we lookup the version from `package.json` to use for those in our templates.
 *
 * @param {{ dependencies: string[], dev_dependencies: string[]}} template
 */
async function get_dependency_versions(template) {
	let rook_pkg = await read_json(path.join(__dirname, "package.json"));
	let lookup = rook_pkg.devDependencies;

	// The "workspace:" is not published to npm, so if present, we are working locally.
	if (Object.values(lookup).some((v) => /^workspace:/.test(v))) {
		let overrides = await gather_workspace_overrides();
		for (let name of Object.keys(lookup)) {
			lookup[name] = overrides[name] ?? lookup[name];
		}
	}

	/** @param {string[]} deps */
	function create_pkg_entry(deps) {
		/** @type {Record<string, string>} */
		let entry = {};
		for (let dep of deps) {
			let version = lookup[dep];
			if (!version) {
				throw new Error(
					`No version found for ${dep}. Must add to create-anywidget/package.json.`,
				);
			}
			entry[dep] = version;
		}
		return entry;
	}
	return {
		dependencies: create_pkg_entry(template.dependencies),
		devDependencies: create_pkg_entry(template.dev_dependencies),
	};
}

/** @returns {Promise<Record<string, string>>} */
async function gather_workspace_overrides() {
	let dirs = await fs.readdir(path.join(__dirname, ".."));
	let entries = dirs
		.filter((dir) => dir !== "create-anywidget")
		.map(async (dir) => {
			let pkg = await read_json(
				path.join(__dirname, "..", dir, "package.json"),
			);
			return [pkg.name, pkg.version];
		});
	return Promise.all(entries).then(Object.fromEntries);
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
readme = "README.md"

[project.optional-dependencies]
dev = ["watchfiles", "jupyterlab"]

# automatically add the dev feature to the default env (e.g., hatch shell)
[tool.hatch.envs.default]
features = ["dev"]
`;

/**
 * @param {string} name
 * @param {string} npm
 */
let pyproject_toml_with_hatch_jupyter_builder = (name, npm) =>
	pyproject_toml(name) +
	`\n
[tool.hatch.build]
only-packages = true
artifacts = ["src/${name}/static/*"]

[tool.hatch.build.hooks.jupyter-builder]
build-function = "hatch_jupyter_builder.npm_builder"
ensured-targets = ["src/${name}/static/widget.js"]
skip-if-exists = ["src/${name}/static/widget.js"]
dependencies = ["hatch-jupyter-builder>=0.5.0"]

[tool.hatch.build.hooks.jupyter-builder.build-kwargs]
npm = "${npm}"
build_cmd = "build"
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
.venv
dist
.DS_Store

# Python
__pycache__
.ipynb_checkpoints

${extras.join("\n")}
`;

/**
 * @param {string} name
 * @param {TemplateType} type
 */
let readme = (name, type = "bundled") => {
	let body = `\
# ${name}

## Installation

\`\`\`sh
pip install ${name}
\`\`\`

## Development installation

Create a virtual environment and and install ${name} in *editable* mode with the
optional development dependencies:

\`\`\`sh
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
\`\`\`

`;

	if (type === "bundled") {
		body = body.concat(`\
You then need to install the JavaScript dependencies and run the development server.

\`\`\`sh
npm install
npm run dev
\`\`\`

`);
	}

	let jsdir = type === "bundled" ? "js/" : `src/${name}/static/`;

	body = body.concat(`\
Open \`example.ipynb\` in JupyterLab, VS Code, or your favorite editor
to start developing. Changes made in \`${jsdir}\` will be reflected
in the notebook.
`);
	return body;
};

/** @param {string} name */
let notebook = (name) =>
	json_dumps({
		"cells": [
			{
				"cell_type": "code",
				"execution_count": null,
				"metadata": {},
				"outputs": [],
				"source": [
					"%load_ext autoreload\n",
					"%autoreload 2\n",
					"%env ANYWIDGET_HMR=1",
				],
			},
			{
				"cell_type": "code",
				"execution_count": null,
				"metadata": {},
				"outputs": [],
				"source": [
					`from ${name} import Counter\n`,
					"Counter()",
				],
			},
		],
		"metadata": {
			"language_info": {
				"name": "python",
			},
		},
		"nbformat": 4,
		"nbformat_minor": 2,
	});

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
import "./widget.css";

const render = createRender(() => {
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

export default { render };
`;

/** @param {string} name */
let widget_react = (name) =>
	`\
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./widget.css";

const render = createRender(() => {
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

export default { render };
`;

/** @param {string} name */
let widget_vanilla = (name) =>
	`\
import "./widget.css";

function render({ model, el }) {
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

export default { render };
`;

/** @param {string} name */
let widget_vanilla_ts = (name) =>
	`\
import type { RenderContext } from "@anywidget/types";
import "./widget.css";

/* Specifies attributes defined with traitlets in ../src/${name}/__init__.py */
interface WidgetModel {
	value: number;
	/* Add your own */
}

function render({ model, el }: RenderContext<WidgetModel>) {
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

export default { render };
`;

function get_tsconfig() {
	return json_dumps({
		include: ["js"],
		compilerOptions: {
			target: "ES2020",
			module: "ESNext",
			lib: ["ES2020", "DOM", "DOM.Iterable"],
			skipLibCheck: true,

			/* Bundler mode */
			moduleResolution: "bundler",
			allowImportingTsExtensions: true,
			resolveJsonModule: true,
			isolatedModules: true,
			noEmit: true,
			jsx: "react",

			/* Linting */
			strict: true,
			noUnusedLocals: true,
			noUnusedParameters: true,
			noFallthroughCasesInSwitch: true,
		},
	});
}

/** @type {Record<string, { entry_point: string, files: { path: string, render: (name: string) => string }[], dependencies: string[], dev_dependencies: string[] }>} */
const bundled_templates = {
	"template-react": {
		entry_point: "js/widget.jsx",
		files: [
			{ path: "js/widget.jsx", render: widget_react },
			{ path: "js/widget.css", render: styles },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: [],
	},
	"template-react-ts": {
		entry_point: "js/widget.tsx",
		files: [
			{ path: "js/widget.tsx", render: widget_react_ts },
			{ path: "js/widget.css", render: styles },
			{ path: "tsconfig.json", render: get_tsconfig },
		],
		dependencies: ["@anywidget/react", "react", "react-dom"],
		dev_dependencies: ["@types/react", "@types/react-dom", "typescript"],
	},
	"template-vanilla": {
		entry_point: "js/widget.js",
		files: [
			{ path: "js/widget.js", render: widget_vanilla },
			{ path: "js/widget.css", render: styles },
		],
		dependencies: [],
		dev_dependencies: [],
	},
	"template-vanilla-ts": {
		entry_point: "js/widget.ts",
		files: [
			{ path: "js/widget.ts", render: widget_vanilla_ts },
			{ path: "js/widget.css", render: styles },
			{ path: "tsconfig.json", render: get_tsconfig },
		],
		dependencies: [],
		dev_dependencies: ["@anywidget/types", "typescript"],
	},
};

/**
 * @param {typeof bundled_templates[keyof bundled_templates]} template
 * @param {{ build_dir: string, typecheck: boolean, pkg_manager: string }} options
 */
async function generate_package_json(
	template,
	{ build_dir, typecheck, pkg_manager },
) {
	/** @type {Record<string, string>} */
	let scripts = {
		dev: "npm run build -- --sourcemap=inline --watch",
	};

	/** @type {string[]} */
	let dev_extra = [];
	if (pkg_manager === "bun") {
		scripts.build =
			`bun build ${template.entry_point} --minify --format=esm --outdir=${build_dir} --asset-naming=[name].[ext]`;
	} else {
		scripts.build =
			`esbuild ${template.entry_point} --minify --format=esm --bundle --outdir=${build_dir}`;
		dev_extra.push("esbuild");
	}

	let { dependencies, devDependencies } = await get_dependency_versions({
		dependencies: template.dependencies,
		dev_dependencies: [...template.dev_dependencies, ...dev_extra],
	});

	if (typecheck) {
		scripts.typecheck = "tsc --noEmit";
	}
	return { scripts, dependencies, devDependencies };
}

/**
 * @param {typeof bundled_templates[keyof bundled_templates]} template
 * @param {{ name: string, pkg_manager: string }} options
 */
async function render_template(template, { name, pkg_manager }) {
	let build_dir = `src/${name}/static`;
	let tsconfig = template.files.find((file) =>
		file.path.includes("tsconfig.json")
	);
	let package_json = await generate_package_json(template, {
		build_dir,
		typecheck: !!tsconfig,
		pkg_manager,
	});
	let files = template.files.map((file) => ({
		path: file.path,
		content: file.render(name),
	}));
	return [
		{ path: `README.md`, content: readme(name) },
		{ path: `example.ipynb`, content: notebook(name) },

		{ path: `.gitignore`, content: gitignore([`src/${name}/static`]) },
		{ path: `package.json`, content: json_dumps(package_json) },
		{
			path: `pyproject.toml`,
			content: pyproject_toml_with_hatch_jupyter_builder(name, pkg_manager),
		},
		{ path: `src/${name}/__init__.py`, content: __init__(name) },
		...files,
	];
}

let deno_json = {
	lock: false,
	compilerOptions: {
		checkJs: true,
		allowJs: true,
		lib: ["ES2020", "DOM", "DOM.Iterable"],
	},
	fmt: {
		exclude: [".venv"],
	},
	lint: {
		exclude: [".venv"],
	},
};

/** @param {string} name */
let widget_esm = (name) =>
	`\
import confetti from "https://esm.sh/canvas-confetti@1";

/** @typedef {{ value: number }} Model */

/** @type {import("npm:@anywidget/types").Render<Model>} */
function render({ model, el }) {
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

export default { render };
`;

/**
 * @param {TemplateType} type
 * @param {{ name: string, pkg_manager: string }} options
 */
export async function gather_files(type, { name, pkg_manager }) {
	if (type === "template-vanilla-deno-jsdoc") {
		return [
			{ path: `README.md`, content: readme(name, type) },
			{ path: `example.ipynb`, content: notebook(name) },
			{ path: `pyproject.toml`, content: pyproject_toml(name) },
			{ path: `deno.json`, content: json_dumps(deno_json) },
			{ path: `.gitignore`, content: gitignore() },
			{ path: `src/${name}/__init__.py`, content: __init__(name) },
			{ path: `src/${name}/static/widget.js`, content: widget_esm(name) },
			{ path: `src/${name}/static/widget.css`, content: styles(name) },
		];
	}
	if (type in bundled_templates) {
		return render_template(bundled_templates[type], { name, pkg_manager });
	}
	throw new Error(`Unknown template type: ${type}`);
}

/** @typedef {{ content: string, path: string }} File */
/** @typedef {keyof bundled_templates | "template-vanilla-deno-jsdoc"} TemplateType */

/**
 * @param {string} target
 * @param {{ name: string, template: TemplateType, pkg_manager: string }} options
 */
export async function create(target, options) {
	const files = await gather_files(options.template, {
		name: snakecase(options.name),
		pkg_manager: options.pkg_manager,
	});
	const promises = files.map(async (file) => {
		let location = path.resolve(target, file.path);
		await fs.mkdir(path.dirname(location), { recursive: true });
		await fs.writeFile(location, file.content, "utf-8");
	});
	await Promise.all(promises);
	return Object.keys(files);
}
