import { describe, test, expect } from "vitest";
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
		const files = await gather_files(template, "ipyfoo");
		expect(files).toMatchSnapshot();
	});
});
