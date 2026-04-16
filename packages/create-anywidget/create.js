import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import snakecase from "just-snake-case";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @param {any} obj */
function jsonDumps(obj) {
  return JSON.stringify(obj, null, "\t");
}

/** @param {string} path */
async function readJson(path) {
  return fs.readFile(path, "utf-8").then(JSON.parse);
}

/**
 * pnpm will help us keep package versions in sync over time, along with dependabot,
 * so we lookup the version from `package.json` to use for those in our templates.
 *
 * @param {{ dependencies: string[], devDependencies: string[]}} template
 */
async function getDependencyVersions(template) {
  let rootPkg = await readJson(path.join(__dirname, "package.json"));
  let lookup = rootPkg.devDependencies;

  // The "workspace:" is not published to npm, so if present, we are working locally.
  if (Object.values(lookup).some((v) => /^workspace:/.test(String(v)))) {
    let overrides = await gatherWorkspaceOverrides();
    for (let name of Object.keys(lookup)) {
      lookup[name] = overrides[name] ?? lookup[name];
    }
  }

  /** @param {string[]} deps */
  function createPkgEntry(deps) {
    /** @type {Record<string, string>} */
    let entry = {};
    for (let dep of deps) {
      let version = lookup[dep];
      if (!version) {
        throw new Error(`No version found for ${dep}. Must add to create-anywidget/package.json.`);
      }
      entry[dep] = version;
    }
    return entry;
  }
  return {
    dependencies: createPkgEntry(template.dependencies),
    devDependencies: createPkgEntry(template.devDependencies),
  };
}

/** @returns {Promise<Record<string, string>>} */
async function gatherWorkspaceOverrides() {
  let dirs = await fs.readdir(path.join(__dirname, ".."));
  let entries = dirs
    .filter((dir) => dir !== "create-anywidget")
    .map(async (dir) => {
      let pkg = await readJson(path.join(__dirname, "..", dir, "package.json"));
      return [pkg.name, `~${pkg.version}`];
    });
  return Promise.all(entries).then(Object.fromEntries);
}

/** @param {string} name */
let pyprojectToml = (name) =>
  `\
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "${name}"
version = "0.0.0"
dependencies = ["anywidget"]
readme = "README.md"

# For projects not using \`uv\`, you can install these development dependencies with:
# \`pip install -e ".[dev]"\`
# If you're using \`uv\` for development, feel free to remove this section.
[project.optional-dependencies]
dev = ["watchfiles", "jupyterlab"]

# Dependency groups (recognized by \`uv\`). For more details, visit:
# https://peps.python.org/pep-0735/
[dependency-groups]
dev = ["watchfiles", "jupyterlab"]
`;

/**
 * @param {string} name
 * @param {string} npm
 */
let pyprojectTomlWithHatchJupyterBuilder = (name, npm) =>
  `${pyprojectToml(name)}\n
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


class Widget(anywidget.AnyWidget):
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

or with [uv](https://github.com/astral-sh/uv):

\`\`\`sh
uv add ${name}
\`\`\`

## Development

We recommend using [uv](https://github.com/astral-sh/uv) for development.
It will automatically manage virtual environments and dependencies for you.

\`\`\`sh
uv run jupyter lab example.ipynb
\`\`\`

Alternatively, create and manage your own virtual environment:

\`\`\`sh
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
jupyter lab example.ipynb
\`\`\`

`;

  if (type === "bundled") {
    body = body.concat(`\
The widget front-end code bundles it's JavaScript dependencies. After setting up Python,
make sure to install these dependencies locally:

\`\`\`sh
npm install
\`\`\`

While developing, you can run the following in a separate terminal to automatically
rebuild JavaScript as you make changes:

\`\`\`sh
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
  jsonDumps({
    cells: [
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: ["%load_ext autoreload\n", "%autoreload 2\n", "%env ANYWIDGET_HMR=1"],
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [`from ${name} import Widget\n`, "Widget()"],
      },
    ],
    metadata: {
      language_info: {
        name: "python",
      },
    },
    nbformat: 4,
    nbformat_minor: 2,
  });

/** @param {string} name */
let styles = (name) =>
  `\
.${name} button {
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

.${name} button:hover {
	transform: scale(1.05);
}
`;

/** @param {string} name */
let widgetReactTs = (name) =>
  `\
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./widget.css";

const render = createRender(() => {
	const [value, setValue] = useModelState<number>("value");
	return (
		<div className="${name}">
			<button onClick={() => setValue(value + 1)}>
				count is {value}
			</button>
		</div>
	);
});

export default { render };
`;

/** @param {string} name */
let widgetReact = (name) =>
  `\
import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./widget.css";

const render = createRender(() => {
	const [value, setValue] = useModelState("value");
	return (
		<div className="${name}">
			<button onClick={() => setValue(value + 1)}>
				count is {value}
			</button>
		</div>
	);
});

export default { render };
`;

/** @param {string} name */
let widgetVanilla = (name) =>
  `\
import "./widget.css";

function render({ model, el }) {
	let btn = document.createElement("button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.classList.add("${name}");
	el.appendChild(btn);
}

export default { render };
`;

/** @param {string} name */
let widgetVanillaTs = (name) =>
  `\
import type { RenderProps } from "@anywidget/types";
import "./widget.css";

/* Specifies attributes defined with traitlets in ../src/${name}/__init__.py */
interface WidgetModel {
	value: number;
	/* Add your own */
}

function render({ model, el }: RenderProps<WidgetModel>) {
	let btn = document.createElement("button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.classList.add("${name}");
	el.appendChild(btn);
}

export default { render };
`;

function cssDeclaration() {
  return `declare module "*.css";\n`;
}

function getTsconfig() {
  return jsonDumps({
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

/** @type {Record<string, { entryPoint: string, files: { path: string, render: (name: string) => string }[], dependencies: string[], devDependencies: string[] }>} */
const bundledTemplates = {
  "template-react": {
    entryPoint: "js/widget.jsx",
    files: [
      { path: "js/widget.jsx", render: widgetReact },
      { path: "js/widget.css", render: styles },
    ],
    dependencies: ["@anywidget/react", "react", "react-dom"],
    devDependencies: [],
  },
  "template-react-ts": {
    entryPoint: "js/widget.tsx",
    files: [
      { path: "js/widget.tsx", render: widgetReactTs },
      { path: "js/widget.css", render: styles },
      { path: "js/css.d.ts", render: cssDeclaration },
      { path: "tsconfig.json", render: getTsconfig },
    ],
    dependencies: ["@anywidget/react", "react", "react-dom"],
    devDependencies: ["@types/react", "@types/react-dom", "typescript"],
  },
  "template-vanilla": {
    entryPoint: "js/widget.js",
    files: [
      { path: "js/widget.js", render: widgetVanilla },
      { path: "js/widget.css", render: styles },
    ],
    dependencies: [],
    devDependencies: [],
  },
  "template-vanilla-ts": {
    entryPoint: "js/widget.ts",
    files: [
      { path: "js/widget.ts", render: widgetVanillaTs },
      { path: "js/widget.css", render: styles },
      { path: "js/css.d.ts", render: cssDeclaration },
      { path: "tsconfig.json", render: getTsconfig },
    ],
    dependencies: [],
    devDependencies: ["@anywidget/types", "typescript"],
  },
};

/**
 * @param {(typeof bundledTemplates)[keyof typeof bundledTemplates]} template
 * @param {{ buildDir: string, typecheck: boolean, pkgManager: string }} options
 */
async function generatePackageJson(template, { buildDir, typecheck, pkgManager }) {
  /** @type {Record<string, string>} */
  let scripts = {
    dev: "npm run build -- --sourcemap=inline --watch",
  };

  /** @type {string[]} */
  let devExtra = [];
  if (pkgManager === "bun") {
    scripts.build = `bun build ${template.entryPoint} --minify --format=esm --outdir=${buildDir} --asset-naming=[name].[ext]`;
  } else {
    scripts.build = `esbuild ${template.entryPoint} --minify --format=esm --bundle --outdir=${buildDir}`;
    devExtra.push("esbuild");
  }

  let { dependencies, devDependencies } = await getDependencyVersions({
    dependencies: template.dependencies,
    devDependencies: [...template.devDependencies, ...devExtra],
  });

  if (typecheck) {
    scripts.typecheck = "tsc --noEmit";
  }
  return { scripts, dependencies, devDependencies };
}

/**
 * @param {(typeof bundledTemplates)[keyof typeof bundledTemplates]} template
 * @param {{ name: string, pkgManager: string }} options
 */
async function renderTemplate(template, { name, pkgManager }) {
  let buildDir = `src/${name}/static`;
  let tsconfig = template.files.find((file) => file.path.includes("tsconfig.json"));
  let packageJson = await generatePackageJson(template, {
    buildDir,
    typecheck: !!tsconfig,
    pkgManager,
  });
  let files = template.files.map((file) => ({
    path: file.path,
    content: file.render(name),
  }));
  return [
    { path: `README.md`, content: readme(name) },
    { path: `example.ipynb`, content: notebook(name) },

    { path: `.gitignore`, content: gitignore([`src/${name}/static`]) },
    { path: `package.json`, content: jsonDumps(packageJson) },
    {
      path: `pyproject.toml`,
      content: pyprojectTomlWithHatchJupyterBuilder(name, pkgManager),
    },
    { path: `src/${name}/__init__.py`, content: __init__(name) },
    ...files,
  ];
}

let denoJson = {
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
let widgetEsm = (name) =>
  `\
import confetti from "https://esm.sh/canvas-confetti@1";

/** @typedef {{ value: number }} Model */

/** @type {import("npm:@anywidget/types").Render<Model>} */
function render({ model, el }) {
	let btn = document.createElement("button");
	btn.innerHTML = \`count is \${model.get("value")}\`;
	btn.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		confetti();
		btn.innerHTML = \`count is \${model.get("value")}\`;
	});
	el.classList.add("${name}");
	el.appendChild(btn);
}

export default { render };
`;

/**
 * @param {TemplateType} type
 * @param {{ name: string, pkgManager: string }} options
 */
export async function gatherFiles(type, { name, pkgManager }) {
  if (type === "template-vanilla-deno-jsdoc") {
    return [
      { path: `README.md`, content: readme(name, type) },
      { path: `example.ipynb`, content: notebook(name) },
      { path: `pyproject.toml`, content: pyprojectToml(name) },
      { path: `deno.json`, content: jsonDumps(denoJson) },
      { path: `.gitignore`, content: gitignore() },
      { path: `src/${name}/__init__.py`, content: __init__(name) },
      { path: `src/${name}/static/widget.js`, content: widgetEsm(name) },
      { path: `src/${name}/static/widget.css`, content: styles(name) },
    ];
  }
  if (type in bundledTemplates) {
    return renderTemplate(bundledTemplates[type], { name, pkgManager });
  }
  throw new Error(`Unknown template type: ${String(type)}`);
}

/** @typedef {{ content: string, path: string }} File */
// oxlint-disable-next-line typescript-eslint/no-redundant-type-constituents -- template-vanilla-deno-jsdoc is not in bundledTemplates
/** @typedef {keyof typeof bundledTemplates | "template-vanilla-deno-jsdoc"} TemplateType */

/**
 * @param {string} target
 * @param {{ name: string, template: TemplateType, pkgManager: string }} options
 */
export async function create(target, options) {
  const files = await gatherFiles(options.template, {
    name: snakecase(options.name),
    pkgManager: options.pkgManager,
  });
  const promises = files.map(async (file) => {
    let location = path.resolve(target, file.path);
    await fs.mkdir(path.dirname(location), { recursive: true });
    await fs.writeFile(location, file.content, "utf-8");
  });
  await Promise.all(promises);
  return Object.keys(files);
}
