import { defineConfig } from "@playwright/test";

export default defineConfig({
	use: {
		headless: false,
	},
	webServer: [
		{
			command: `jupyter lab --port=8888 --LabApp.token="" e2e/`,
			url: "http://localhost:8888/",
			timeout: 120 * 1000,
		},
		{
			command:
				`jupyter notebook --port=8889 --NotebookApp.password="" --NotebookApp.token="" e2e/`,
			url: "http://localhost:8889/",
			timeout: 120 * 1000,
		},
	],
});
