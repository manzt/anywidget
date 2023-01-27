import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";

import { expect, test } from "@playwright/test";

import { version } from "../package.json";

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
	let source = path.resolve(__dirname, "fixtures", "html.ipynb");

	// Convert the notebook to HTML and inject on page
	/** @type {string} */
	let html = await new Promise((resolve, reject) =>
		child_process.exec(
			`jupyter nbconvert --execute --to html --stdout ${source}`,
			(err, stdout) => {
				if (err) reject(err);
				resolve(stdout);
			}
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

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} outputs Jupyter output cells
 */
async function test_executed(page, outputs) {
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

/**
 * Runs a "live" test suite in Jupyter/JupyterLab notebook
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} outputs Jupyter output cells
 */
async function test_interactive(page, outputs) {
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
