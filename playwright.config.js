import { defineConfig } from "@playwright/test";

export default defineConfig({
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: "html",
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",
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
