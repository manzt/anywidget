import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

let source = path.resolve(__dirname, "Test.ipynb");

// https://github.com/jupyter/nbconvert/issues/1900
let sourceNoArrowFuncs = path.resolve(__dirname, "TestHTML.ipynb");

let fixtures = path.resolve(__dirname, "fixtures");

import { version } from "../package.json";

test.beforeAll(async () => {
	if (fs.existsSync(fixtures)) {
		await fs.promises.rm(fixtures, { recursive: true });
	}
	await fs.promises.mkdir(fixtures);
	await fs.promises.copyFile(
		source,
		path.resolve(__dirname, "fixtures/notebook.ipynb"),
	);
	await fs.promises.copyFile(
		source,
		path.resolve(__dirname, "fixtures/lab.ipynb"),
	);
});

test.afterAll(async () => {
	if (fs.existsSync(fixtures)) {
		await fs.promises.rm(fixtures, { recursive: true });
	}
});

test("Jupyter notebook", async ({ page }) => {
	await page.goto("http://localhost:8889/notebooks/fixtures/notebook.ipynb");
	await test_interactive(page, page.locator(".output"));
});

test("JupyterLab", async ({ page }) => {
	await page.goto("http://localhost:8888/lab/tree/fixtures/lab.ipynb");
	await test_interactive(page, page.locator(".jp-OutputArea"));
});

test("nbconvert HTML", async ({ page }) => {
	let location = "http://localhost:1234";

	// Convert the notebook to HTML and inject on page
	let html = await new Promise<string>((resolve) =>
		child_process.exec(
			`jupyter nbconvert --execute --to html --stdout ${sourceNoArrowFuncs}`,
			(_, stdout) => resolve(stdout),
		)
	);

	// serve HTML from localhost
	page.route(location, (route) => {
		route.fulfill({ body: html, contentType: "text/html" });
	});

	// intercept requests to CDN from html-manager
	page.route(
		`https://cdn.jsdelivr.net/npm/anywidget@${version}/dist/index.js`,
		async (route) => {
			route.fulfill({
				body: await fs.promises.readFile(
					path.join(__dirname, "../anywidget/nbextension/index.js"),
				),
				contentType: "text/javascript",
			});
		},
	);

	await page.goto(location);
	await test_executed(page, page.locator(".jp-OutputArea"));
});

async function test_executed(_: Page, outputs: Locator) {
	let btn = outputs.nth(0).locator(".counter-button");
	let py_output = outputs.nth(1).locator("pre");

	await expect(btn).toBeVisible();
	await expect(btn).toHaveCSS("color", "rgb(255, 0, 0)");
	await expect(btn).toHaveText("count is 100");
	await expect(py_output).toHaveText("10");

	await btn.click();
	await btn.click();
	await expect(btn).toHaveText("count is 102");
}

/** Runs a "live" test suite in Jupyter/JupyterLab notebook. */
async function test_interactive(page: Page, outputs: Locator) {
	await page.waitForLoadState("networkidle");

	// idk, this helps to make tests not randomly fail
	await new Promise((resolve) => setTimeout(resolve, 3000));

	// Widget button
	let btn = outputs.nth(0).locator(".counter-button");
	// Python cell
	let py_output = outputs.nth(1).locator("pre");

	// Execute first cell (twice, just to make sure it has executed)
	await page.getByRole("textbox").nth(0).press("Shift+Enter");

	// Button is shown with correct initialized count
	await expect(btn).toBeVisible();
	await expect(btn).toHaveCSS("color", "rgb(255, 0, 0)");
	await expect(btn).toHaveText("count is 10");

	// Make sure Python state is initialized correctly
	await page.getByRole("textbox").nth(1).press("Shift+Enter");
	await expect(py_output).toHaveText("10");

	// JS -> Python sync works
	await btn.click();
	await btn.click();
	await expect(btn).toHaveText("count is 12");
	await page.getByRole("textbox").nth(1).press("Shift+Enter");
	await expect(py_output).toHaveText("12");

	// Python -> JS sync works
	await page.getByRole("textbox").nth(2).press("Shift+Enter");
	await page.getByRole("textbox").nth(1).press("Shift+Enter");
	await expect(py_output).toHaveText("100");
	await expect(btn).toHaveText("count is 100");
}
