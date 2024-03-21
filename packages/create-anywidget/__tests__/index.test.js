// @ts-check
import { beforeAll, describe, expect, test } from "vitest";
import { gather_files } from "../create.js";

describe("create-anywidget", () => {
	test.each(
		/** @type {const} */ ([
			"template-vanilla",
			"template-vanilla-ts",
			"template-vanilla-deno-jsdoc",
			"template-react",
			"template-react-ts",
		]),
	)(`%s`, async (template) => {
		const files = await gather_files(template, {
			name: "ipyfoo",
			pkg_manager: "npm",
		});
		expect(files).toMatchSnapshot();
	});
});

describe("create-anywidget (Bun)", () => {
	beforeAll(() => {
		if (!globalThis.Bun) {
			globalThis.Bun = true;
		}
	});

	test.each(
		/** @type {const} */ ([
			"template-vanilla",
			"template-vanilla-ts",
			"template-vanilla-deno-jsdoc",
			"template-react",
			"template-react-ts",
		]),
	)(`%s`, async (template) => {
		const files = await gather_files(template, {
			name: "ipyfoo",
			pkg_manager: "bun",
		});
		expect(files).toMatchSnapshot();
	});
});
