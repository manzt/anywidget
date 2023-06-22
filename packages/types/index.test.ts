import { describe, expectTypeOf, it, vi } from "vitest";
import type { AnyModel, ObjectHash } from "./index.js";

type MockModel<T extends ObjectHash> = AnyModel<T> & {
	execute_callbacks(): void;
};

function createModelMock<T extends ObjectHash = ObjectHash>(): MockModel<T> {
	let callbacks: Array<() => void> = [];
	return {
		get: vi.fn(),
		set: vi.fn(),
		on: vi.fn((_, callback) => {
			callbacks.push(callback);
		}),
		off: vi.fn(),
		save_changes: vi.fn(),
		send: vi.fn(),
		execute_callbacks() {
			callbacks.forEach((cb) => cb());
		},
	};
}

describe("AnyModel.get", () => {
	it("uses strict types when model is provided", () => {
		let model = createModelMock<{ value: number; name: string }>();
		expectTypeOf(model.get("value")).toEqualTypeOf<number>();
		expectTypeOf(model.get("name")).toEqualTypeOf<string>();
		// @ts-expect-error - foo is not found on the model
		model.get("foo");
	});

	it("defers to any when model is unknown", () => {
		let model = createModelMock();
		expectTypeOf(model.get("foo")).toEqualTypeOf<any>();
	});
});

describe("AnyModel.set", () => {
	it("requires strict types when model is provided", () => {
		let model = createModelMock<{ value: number; name: string }>();
		model.set("value", 42);
		model.set("name", "Ricky Martin");
		// @ts-expect-error - foo is not found on the model
		model.set("foo", "bar");
	});

	it("allows any when model is unknown", () => {
		let model = createModelMock();
		model.set("foo", "bar");
	});
});

describe("AnyModel.on", () => {
	it("infers custom message payload for untyped Model", async () => {
		let model = createModelMock();
		await new Promise<void>((resolve) => {
			model.on("msg:custom", (msg, buffers) => {
				expectTypeOf(msg).toEqualTypeOf<any>();
				expectTypeOf(buffers).toEqualTypeOf<DataView[]>();
				resolve();
			});
			model.execute_callbacks();
		});
	});

	it("infers custom message payload for typed Model", async () => {
		let model = createModelMock<{ value: number }>();
		await new Promise<void>((resolve) => {
			model.on("msg:custom", (msg, buffers) => {
				expectTypeOf(msg).toEqualTypeOf<any>();
				expectTypeOf(buffers).toEqualTypeOf<DataView[]>();
				resolve();
			});
			model.execute_callbacks();
		});
	});

	it("infers any payload for untyped Model", async () => {
		let model = createModelMock();
		await new Promise<void>((resolve) => {
			model.on("change:value", (context, value) => {
				expectTypeOf(context).toEqualTypeOf<unknown>();
				expectTypeOf(value).toEqualTypeOf<any>();
				resolve();
			});
			model.execute_callbacks();
		});
	});

	it("infers typed payload for typed Model", async () => {
		let model = createModelMock<{ value: number }>();
		await new Promise<void>((resolve) => {
			model.on("change:value", (context, value) => {
				expectTypeOf(context).toEqualTypeOf<unknown>();
				expectTypeOf(value).toEqualTypeOf<number>();
				resolve();
			});
			model.execute_callbacks();
		});
	});

	it("infers any payload for unknown field of typed Model", async () => {
		let model = createModelMock<{ value: number }>();
		await new Promise<void>((resolve) => {
			model.on("change:foo", (context, value) => {
				expectTypeOf(context).toEqualTypeOf<unknown>();
				expectTypeOf(value).toEqualTypeOf<any>();
				resolve();
			});
			model.execute_callbacks();
		});
	});

	it("infers any for unknown event", async () => {
		let model = createModelMock<{ value: number }>();
		await new Promise<void>((resolve) => {
			model.on("foo:bar", (...args) => {
				expectTypeOf(args).toEqualTypeOf<any[]>();
				resolve();
			});
			model.execute_callbacks();
		});
	});
});
