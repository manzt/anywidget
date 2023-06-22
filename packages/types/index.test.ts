import { vi, describe, it, expectTypeOf } from "vitest";
import type { ObjectHash, AnyModel } from "./index.js";

function createModel<T extends ObjectHash = ObjectHash>(): AnyModel<T> {
	return {
		get: vi.fn(),
		set: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		save_changes: vi.fn(),
		send: vi.fn(),
	};
}

describe("AnyModel.get", () => {
	it("uses strict types when model is provided", () => {
		let model = createModel<{ value: number, name: string }>();
		expectTypeOf(model.get("value")).toEqualTypeOf<number>();
		expectTypeOf(model.get("name")).toEqualTypeOf<string>();
		// @ts-expect-error - foo is not found on the model
		model.get("foo");
	});

	it("defers to any when model is unknown", () => {
		let model = createModel();
		expectTypeOf(model.get("foo")).toEqualTypeOf<any>();
	});
});

describe("AnyModel.set", () => {
	it("requires strict types when model is provided", () => {
		let model = createModel<{ value: number, name: string }>();
		model.set("value", 42);
		model.set("name", "Ricky Martin");
		// @ts-expect-error - foo is not found on the model
		model.set("foo", "bar");
	});

	it("allows any when model is unknown", () => {
		let model = createModel();
		model.set("foo", "bar");
	});
});
