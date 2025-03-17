import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			exclude: ["**/node_modules/**", "**/dist/**", "packages/anywidget/**"],
			name: "unit",
			environment: "node",
			typecheck: {
				enabled: true,
			},
		},
	},
	{
		test: {
			include: ["packages/anywidget/**/*.test.{js,ts}"],
			name: "browser",
			browser: {
				provider: "playwright",
				headless: true,
				enabled: true,
				instances: [{ browser: "chromium" }],
			},
		},
	},
]);
