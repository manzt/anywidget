import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			include: ["packages/create-anywidget/**/*.test.{js,ts}"],
			name: "unit",
			environment: "node",
		},
	},
	{
		test: {
			include: ["packages/anywidget/**/*.test.{js,ts}"],
			name: "browser",
			browser: {
				enabled: true,
				instances: [{ browser: "chromium" }],
			},
		},
	},
]);
