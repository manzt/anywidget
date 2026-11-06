import * as widgets from "@jupyter-widgets/base";
import * as baseManager from "@jupyter-widgets/base-manager";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import createAnywidget from "../src/widget.js";

let anywidget = createAnywidget(widgets);
let numComms = 0;

type CommData = Parameters<widgets.IClassicComm["send"]>[0];

class MockComm implements widgets.IClassicComm {
  comm_id = `mock-${numComms++}`;
  target_name = "dummy";
  #onOpen: ((x?: unknown) => void) | null = null;
  #onClose: ((x?: unknown) => void) | null = null;
  /** The model's comm message handler, once registered. */
  onMsg: ((msg: unknown) => void) | null = null;

  on_open(fn: () => void): void {
    this.#onOpen = fn;
  }

  on_close(fn: (x: unknown) => void): void {
    this.#onClose = fn;
  }

  on_msg(fn: (msg: unknown) => void): void {
    this.onMsg = fn;
  }

  open(): string {
    this.#onOpen?.();
    return "";
  }

  close(): string {
    this.#onClose?.();
    return "";
  }

  send(_data: CommData): string {
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

declare global {
  var __anywidgetHoistedEvaluations: number | undefined;
}

/** A shared `_esm`/`_css` asset: a plain model holding `contents`. */
async function createAsset(widgetManager: Manager, contents: string) {
  return widgetManager.new_widget(
    {
      model_name: "AnyAssetModel",
      model_module: "anywidget",
      model_module_version: "0.1.0",
      view_name: null,
      view_module: null,
      view_module_version: "",
      model_id: widgets.uuid(),
    },
    {
      _model_name: "AnyAssetModel",
      _model_module: "anywidget",
      _model_module_version: "0.1.0",
      _view_name: null,
      contents,
    },
  );
}

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

it("applies state updates received while the widget is still loading", async () => {
  let widgetManager = new Manager();
  // The top-level await keeps the module loading (and the model unbound)
  // while we send a Python->JS state update below.
  let esm = `\
await new Promise((resolve) => setTimeout(resolve, 100));
globalThis.__anywidgetTestLoaded = true;
function render({ model, el }) {
	el.innerText = "value is " + model.get("value");
}
export default { render };
`;
  Reflect.deleteProperty(globalThis, "__anywidgetTestLoaded");
  let model = await createWidget({
    widgetManager,
    esm,
    state: { value: 0 },
  });
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- minimal IKernelCommMessage shape for a state update
  await model._handle_comm_msg({
    content: { data: { method: "update", state: { value: 42 } } },
  } as unknown as Parameters<typeof model._handle_comm_msg>[0]);
  // The update must apply without waiting for the module to finish loading.
  expect(model.get("value")).toBe(42);
  expect(Reflect.get(globalThis, "__anywidgetTestLoaded")).toBeUndefined();
  // And the view renders with the pre-load state once loaded.
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("value is 42")).toBeInTheDocument();
});

it("delivers kernel replies awaited inside initialize", async () => {
  // Answers every anywidget command through the model's own message handler,
  // the way a kernel reply arrives. Holding comm messages until the widget was
  // bound (removed in #1032) made this a cycle: the reply waited on bind, bind
  // waited on `initialize`, and `initialize` waited on the reply.
  class ReplyComm extends MockComm {
    send(data: CommData): string {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- `WidgetModel.send` wraps the payload as `{ method: "custom", content }`
      let msg = data as { method?: string; content?: { id?: string; kind?: string } };
      if (msg.method !== "custom" || msg.content?.kind !== "anywidget-command") return "";
      let id = msg.content.id;
      queueMicrotask(() => {
        this.onMsg?.({
          content: {
            data: {
              method: "custom",
              content: { id, kind: "anywidget-command-response", response: "pong" },
            },
          },
        });
      });
      return "";
    }
  }
  class ReplyManager extends Manager {
    async _create_comm(): Promise<MockComm> {
      return new ReplyComm();
    }
  }
  let widgetManager = new ReplyManager();
  let esm = `\
let reply;
export default {
	async initialize({ experimental }) {
		[reply] = await experimental.invoke("ping");
	},
	render({ el }) {
		el.innerText = "reply: " + reply;
	},
};
`;
  let model = await createWidget({ widgetManager, esm });
  let view = await widgetManager.create_view(model);
  document.body.appendChild(view.el);
  await expect.element(page.getByText("reply: pong")).toBeInTheDocument();
});

it("shares one module and one stylesheet across models that reference the same assets", async () => {
  let widgetManager = new Manager();
  let esm = await createAsset(
    widgetManager,
    `\
globalThis.__anywidgetHoistedEvaluations = (globalThis.__anywidgetHoistedEvaluations ?? 0) + 1;
function render({ model, el }) {
	el.classList.add("hoisted-test");
	el.innerText = "hoisted " + model.get("value");
}
export default { render };
`,
  );
  let css = await createAsset(widgetManager, `.hoisted-test { background-color: lightgreen }`);
  let ref = (model: widgets.WidgetModel) => `anywidget-asset:${model.model_id}`;
  let a = await createWidget({ widgetManager, esm: ref(esm), css: ref(css), state: { value: 1 } });
  let b = await createWidget({ widgetManager, esm: ref(esm), css: ref(css), state: { value: 2 } });

  // References are resolved to the asset models before construction.
  expect(a.get("_esm")).toBe(esm);
  expect(b.get("_css")).toBe(css);

  let viewA = await widgetManager.create_view(a);
  let viewB = await widgetManager.create_view(b);
  document.body.appendChild(viewA.el);
  document.body.appendChild(viewB.el);
  await expect.element(page.getByText("hoisted 1")).toBeInTheDocument();
  await expect.element(page.getByText("hoisted 2")).toBeInTheDocument();
  expect(globalThis.__anywidgetHoistedEvaluations).toBe(1);
  expect(
    globalThis.getComputedStyle(viewB.el).getPropertyValue("background-color"),
  ).toMatchInlineSnapshot(`"rgb(144, 238, 144)"`);
  expect(document.querySelectorAll(`style[id='${css.model_id}']`)).toHaveLength(1);

  // Hot reload flows through the asset and reaches every model using it.
  esm.set(
    "contents",
    `\
function render({ model, el }) {
	el.innerText = "HOISTED " + model.get("value");
}
export default { render };
`,
  );
  await expect.element(page.getByText("HOISTED 1")).toBeInTheDocument();
  await expect.element(page.getByText("HOISTED 2")).toBeInTheDocument();
  css.set("contents", `.hoisted-test { background-color: red }`);
  expect(
    globalThis.getComputedStyle(viewA.el).getPropertyValue("background-color"),
  ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`);

  // Saved widget state carries the reference, not the model.
  let saved = await widgetManager.get_state();
  expect(saved.state[a.model_id].state._esm).toBe(ref(esm));
  expect(saved.state[a.model_id].state._css).toBe(ref(css));
});
