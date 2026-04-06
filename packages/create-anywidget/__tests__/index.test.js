// @ts-check
import { beforeAll, describe, expect, test } from "vite-plus/test";

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
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- shimming globalThis.Bun for test
    if (!(/** @type {any} */ (globalThis).Bun)) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      /** @type {any} */ (globalThis).Bun = true;
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
