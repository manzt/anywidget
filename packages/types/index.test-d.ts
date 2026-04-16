import { describe, expectTypeOf, it } from "vitest";

import type { AnyModel, AnyWidget, Host } from "./index.ts";

declare let model: AnyModel;
declare let typedModel: AnyModel<{ value: number; name: string }>;

describe("AnyModel.get", () => {
  it("uses strict types when model is provided", () => {
    expectTypeOf(typedModel.get("value")).toEqualTypeOf<number>();
    expectTypeOf(typedModel.get("name")).toEqualTypeOf<string>();
    // @ts-expect-error - foo is not found on the model
    typedModel.get("foo");
  });

  it("defers to any when model is unknown", () => {
    expectTypeOf(model.get("foo")).toEqualTypeOf<any>();
  });
});

describe("AnyModel.set", () => {
  it("requires strict types when model is provided", () => {
    typedModel.set("value", 42);
    typedModel.set("name", "Ricky Martin");
    // @ts-expect-error - foo is not found on the model
    typedModel.set("foo", "bar");
  });

  it("allows any when model is unknown", () => {
    model.set("foo", "bar");
  });
});

describe("AnyModel.on", () => {
  it("infers custom message payload for untyped Model", async () => {
    model.on("msg:custom", (msg, buffers) => {
      expectTypeOf(msg).toEqualTypeOf<any>();
      expectTypeOf(buffers).toEqualTypeOf<DataView[]>();
    });
  });

  it("infers custom message payload for typed Model", async () => {
    typedModel.on("msg:custom", (msg, buffers) => {
      expectTypeOf(msg).toEqualTypeOf<any>();
      expectTypeOf(buffers).toEqualTypeOf<DataView[]>();
    });
  });

  it("accepts no-argument callback for untyped Model", async () => {
    model.on("change:value", () => {});
  });

  it("accepts no-argument callback for typed Model", async () => {
    typedModel.on("change:value", () => {});
  });

  it("accepts no-argument callback for unknown field of typed Model", async () => {
    typedModel.on("change:foo", () => {});
  });

  it("infers any for unknown event", async () => {
    model.on("foo:bar", (...args) => {
      expectTypeOf(args).toEqualTypeOf<any[]>();
    });
  });
});

describe("Define AnyWidget", () => {
  it("infers initialize and render for static widget", () => {
    let _w: AnyWidget<{ value: number }> = {
      initialize({ model, signal }) {
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
      },
      render({ model, el, signal, host }) {
        expectTypeOf(el).toEqualTypeOf<HTMLElement>();
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
        expectTypeOf(host).toEqualTypeOf<Host>();
      },
    };
  });

  it("infers initialize and render for function widget", () => {
    let _w: AnyWidget<{ value: number }> = () => ({
      initialize({ model, signal }) {
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
      },
      render({ model, el, signal, host }) {
        expectTypeOf(el).toEqualTypeOf<HTMLElement>();
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
        expectTypeOf(host).toEqualTypeOf<Host>();
      },
    });
  });

  it("infers initialize and render for async function widget", () => {
    let _w: AnyWidget<{ value: number }> = async () => ({
      initialize({ model, signal }) {
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
      },
      render({ model, el, signal, host }) {
        expectTypeOf(el).toEqualTypeOf<HTMLElement>();
        expectTypeOf(model.get("value")).toEqualTypeOf<number>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
        expectTypeOf(host).toEqualTypeOf<Host>();
      },
    });
  });

  it("allows initialize to return exports object", () => {
    let _w: AnyWidget<{ value: number }> = {
      initialize() {
        return { getValue: () => 42 };
      },
    };
  });

  it("allows initialize to return cleanup function", () => {
    let _w: AnyWidget<{ value: number }> = {
      initialize() {
        return () => {};
      },
    };
  });

  it("allows initialize to return void", () => {
    let _w: AnyWidget<{ value: number }> = {
      initialize() {},
    };
  });
});

describe("Host", () => {
  // @ts-expect-error - type-only tests
  let host: Host = {};

  it("resolves widget with typed exports", async () => {
    let widget = await host.getWidget<{ getValue(): number }>("anywidget:abc");
    expectTypeOf(widget.exports.getValue()).toEqualTypeOf<number>();
    expectTypeOf(widget.render.bind(widget)).toEqualTypeOf<
      (opts: { el: HTMLElement; signal?: AbortSignal }) => Promise<void>
    >();
  });

  it("resolves model", async () => {
    let model = await host.getModel<{ value: number }>("anywidget:abc");
    expectTypeOf(model.get("value")).toEqualTypeOf<number>();
  });

  it("defaults exports to unknown", async () => {
    let widget = await host.getWidget("anywidget:abc");
    expectTypeOf(widget.exports).toEqualTypeOf<unknown>();
  });
});
