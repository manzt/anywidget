import * as widgets from "@jupyter-widgets/base";
import * as baseManager from "@jupyter-widgets/base-manager";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import createAnywidget from "../src/widget.js";

let anywidget = createAnywidget(widgets);
let numComms = 0;

class MockComm implements widgets.IClassicComm {
  comm_id = `mock-${numComms++}`;
  target_name = "dummy";
  #onOpen: ((x?: unknown) => void) | null = null;
  #onClose: ((x?: unknown) => void) | null = null;

  on_open(fn: () => void): void {
    this.#onOpen = fn;
  }

  on_close(fn: (x: unknown) => void): void {
    this.#onClose = fn;
  }

  on_msg(): void {}

  open(): string {
    this.#onOpen?.();
    return "";
  }

  close(): string {
    this.#onClose?.();
    return "";
  }

  send(): string {
    return "";
  }
}

class Manager extends baseManager.ManagerBase {
  async loadClass(
    className: string,
    moduleName: string,
  ): Promise<typeof widgets.WidgetModel | typeof widgets.WidgetView> {
    if (moduleName === "@jupyter-widgets/base") {
      // @ts-expect-error - Types can't narrow here
      // oxlint-disable-next-line import/namespace
      return widgets[className];
    }
    if (moduleName === "anywidget") {
      // @ts-expect-error - Types can't narrow here
      return anywidget[className];
    }
    throw new Error(`Cannot find module ${moduleName}`);
  }

  async _create_comm(): Promise<MockComm> {
    return new MockComm();
  }

  _get_comm_info(): never {
    throw new Error("Should never be called.");
  }
}

let _esm = `\
function render({ model, el }) {
  let count = () => model.get("value");
  let btn = document.createElement("button");
  btn.style.fontSize = "2em";
  btn.innerText = "count is " + count();
  btn.addEventListener("click", () => {
    model.set("value", count() + 1);
    model.save_changes();
  });
  model.on("change:value", () => {
    btn.innerText = "count is " + count();
  });
  el.appendChild(btn);
}
export default { render };
`;

async function createWidget(options: {
  widgetManager: Manager;
  esm: string;
  css?: string;
  state?: Record<string, unknown>;
}): Promise<InstanceType<typeof anywidget.AnyModel>> {
  let { widgetManager, esm, css, state = {} } = options;
  let modelOptions = {
    model_name: "AnyModel",
    model_module: "anywidget",
    model_module_version: "0.1.0",
    view_name: "AnyView",
    view_module: "anywidget",
    view_module_version: "0.1.0",
  } as const;
  let model = await widgetManager.new_widget(
    {
      ...modelOptions,
      model_id: widgets.uuid(),
    },
    {
      _model_name: modelOptions.model_name,
      _model_module: modelOptions.model_module,
      _model_module_version: modelOptions.model_module_version,
      _view_name: modelOptions.view_name,
      _view_module: modelOptions.view_module,
      _view_module_version: modelOptions.view_module_version,
      _esm: esm,
      _anywidget_id: "anywidget-test",
      ...(css ? { _css: css } : {}),
      ...state,
    },
  );
  return model;
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelector("#anywidget-test")?.remove();
});

it("creates an anywidget", async () => {
  let widgetManager = new Manager();
  let model = await createWidget({
    widgetManager,
    esm: _esm,
  });
  expect(model).toBeInstanceOf(anywidget.AnyModel);
  expect(model.get("_esm")).toBe(_esm);
  expect(model.get("_css")).toBe(undefined);
});

it("renders view", async () => {
  let widgetManager = new Manager();
  let esm = `\
function render({ model, el }) {
	el.innerText = "Hello, world";
}
export default { render };
	`;
  let model = await createWidget({
    widgetManager,
    esm: esm,
  });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("Hello, world")).toBeInTheDocument();
});

it("renders view with styles", async () => {
  let widgetManager = new Manager();
  let esm = `\
function render({ model, el }) {
	el.classList.add("basic-test");
	el.innerText = "Hello, world";
}
export default { render };
	`;
  let css = `
.basic-test {
	background-color: lightgreen;
}
`;
  let model = await createWidget({
    widgetManager,
    esm: esm,
    css: css,
  });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("Hello, world")).toBeInTheDocument();
  expect(
    globalThis.getComputedStyle(view.el).getPropertyValue("background-color"),
  ).toMatchInlineSnapshot(`"rgb(144, 238, 144)"`);
});

it("updates view on model changes", async () => {
  let widgetManager = new Manager();
  let esm = `\
function render({ model, el }) {
	let button = document.createElement("button");
	button.innerHTML = "count is " + model.get("value");
	button.addEventListener("click", () => {
		model.set("value", model.get("value") + 1);
		model.save_changes();
	});
	model.on("change:value", () => {
		button.innerHTML = "count is " + model.get("value");
	});
	el.appendChild(button);
}
export default { render };
`;
  let model = await createWidget({
    widgetManager,
    esm: esm,
    state: { value: 0 },
  });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("count is 0")).toBeInTheDocument();
  model.set("value", 10);
  await expect.element(page.getByText("count is 10")).toBeInTheDocument();
  await userEvent.click(page.getByText("count is 10"));
  expect(model.get("value")).toBe(11);
  await expect.element(page.getByText("count is 11")).toBeInTheDocument();
});

it("performs HMR update for _esm", async () => {
  let widgetManager = new Manager();
  let esm = `\
function render({ model, el }) {
	el.innerText = "hello. " + model.get("value");
	model.on("change:value", () => {
		el.innerText = "hello. " + model.get("value");
	});
}
export default { render };
`;
  let model = await createWidget({
    widgetManager,
    esm: esm,
    state: { value: 0 },
  });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("hello. 0")).toBeInTheDocument();
  model.set("value", 10);
  await expect.element(page.getByText("hello. 10")).toBeInTheDocument();
  model.set(
    "_esm",
    `\
function render({ model, el }) {
	el.innerText = "HELLO. " + model.get("value");
}
export default { render };
`,
  );
  await expect.element(page.getByText("HELLO. 10")).toBeInTheDocument();
});

it("performs HMR update for _css", async () => {
  let widgetManager = new Manager();
  let esm = `\
function render({ model, el }) {
	el.classList.add("anywidget-hmr-test")
	el.innerText = "hi"
}
export default { render };
`;
  let model = await createWidget({
    widgetManager,
    esm: esm,
    css: `.anywidget-hmr-test { background-color: lightgreen }`,
  });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("hi")).toBeInTheDocument();
  expect(
    globalThis.getComputedStyle(view.el).getPropertyValue("background-color"),
  ).toMatchInlineSnapshot(`"rgb(144, 238, 144)"`);
  model.set("_css", `.anywidget-hmr-test { background-color: red }`);
  expect(
    globalThis.getComputedStyle(view.el).getPropertyValue("background-color"),
  ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`);
});
