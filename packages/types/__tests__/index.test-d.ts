import { describe, it, expectTypeOf } from "vitest";
import type { AnyModel } from "../index.js";

declare let model: AnyModel;
declare let typedModel: AnyModel<{ value: number, name: string }>;

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

	it("infers any payload for untyped Model", async () => {
		model.on("change:value", (context, value) => {
			expectTypeOf(context).toEqualTypeOf<unknown>();
			expectTypeOf(value).toEqualTypeOf<any>();
		});
	});

	it("infers typed payload for typed Model", async () => {
		typedModel.on("change:value", (context, value) => {
			expectTypeOf(context).toEqualTypeOf<unknown>();
			expectTypeOf(value).toEqualTypeOf<number>();
		});
	});

	it("infers any payload for unknown field of typed Model", async () => {
		typedModel.on("change:foo", (context, value) => {
			expectTypeOf(context).toEqualTypeOf<unknown>();
			expectTypeOf(value).toEqualTypeOf<any>();
		});
	});

	it("infers any for unknown event", async () => {
		model.on("foo:bar", (...args) => {
			expectTypeOf(args).toEqualTypeOf<any[]>();
		});
	});
});
