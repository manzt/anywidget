import type { Host } from "@anywidget/types";
import type { DOMWidgetModel } from "@jupyter-widgets/base";
import { afterEach, expect, it, vi } from "vitest";

import { WidgetBinding } from "../src/binding.js";
import { promiseWithResolvers } from "../src/util.js";

function createModel(): DOMWidgetModel {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- createView only touches the methods modelProxy binds
  return {
    get: vi.fn(),
    set: vi.fn(),
    save_changes: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    widget_manager: {},
  } as unknown as DOMWidgetModel;
}

async function createBinding(): Promise<{
  binding: WidgetBinding;
  connected: boolean[];
}> {
  let binding = new WidgetBinding(createModel());
  let connected: boolean[] = [];
  await binding.bind(
    {
      render({ el }) {
        connected.push(el.isConnected);
      },
    },
    // @ts-expect-error - render never calls invoke
    { experimental: {} },
  );
  return { binding, connected };
}

function createViewOptions(signal: AbortSignal): Parameters<WidgetBinding["createView"]>[1] {
  return {
    signal,
    // @ts-expect-error - render never calls invoke
    experimental: {},
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- render never calls host
    host: {} as Host,
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("renders an attached target without waiting for a frame", async () => {
  let { binding, connected } = await createBinding();
  let el = document.createElement("div");
  document.body.appendChild(el);
  let raf = vi.spyOn(globalThis, "requestAnimationFrame");

  await binding.createView({ el }, createViewOptions(new AbortController().signal));

  expect(connected).toEqual([true]);
  expect(raf).not.toHaveBeenCalled();
});

it("renders a detached target once it is attached", async () => {
  let { binding, connected } = await createBinding();
  let el = document.createElement("div");

  let view = binding.createView({ el }, createViewOptions(new AbortController().signal));
  await nextFrame();
  await nextFrame();
  expect(connected).toEqual([]);
  document.body.appendChild(el);
  await view;

  expect(connected).toEqual([true]);
});

it("renders when displayed resolves, before the next frame", async () => {
  let { binding, connected } = await createBinding();
  let el = document.createElement("div");
  let displayed = promiseWithResolvers<void>();
  // Frames never fire, so only `displayed` can unblock the render.
  let raf = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

  let view = binding.createView(
    { el, displayed: displayed.promise },
    createViewOptions(new AbortController().signal),
  );
  await Promise.resolve();
  expect(connected).toEqual([]);
  document.body.appendChild(el);
  displayed.resolve();
  await view;

  expect(connected).toEqual([true]);
  expect(raf).toHaveBeenCalledTimes(1);
});

it("polls when displayed resolves before the target is attached", async () => {
  let { binding, connected } = await createBinding();
  let el = document.createElement("div");

  let view = binding.createView(
    { el, displayed: Promise.resolve() },
    createViewOptions(new AbortController().signal),
  );
  await nextFrame();
  await nextFrame();
  expect(connected).toEqual([]);
  document.body.appendChild(el);
  await view;

  expect(connected).toEqual([true]);
});

it("does not render when aborted while waiting", async () => {
  let { binding, connected } = await createBinding();
  let el = document.createElement("div");
  let controller = new AbortController();

  let view = binding.createView({ el }, createViewOptions(controller.signal));
  await nextFrame();
  controller.abort();
  await view;
  document.body.appendChild(el);
  await nextFrame();

  expect(connected).toEqual([]);
});
