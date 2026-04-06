import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  fmt: {
    experimentalSortImports: {},
  },
  lint: {
    plugins: ["typescript", "import"],
    ignorePatterns: ["packages/deno", "packages/signals"],
    categories: {
      correctness: "error",
      suspicious: "error",
    },
    rules: {
      "import/no-unassigned-import": [
        "error",
        { allow: ["**/*.css", "**/*.scss", "@docsearch/css"] },
      ],
      "no-shadow": "off",
    },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    projects: [
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
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium", provider: playwright() }],
          },
        },
      },
    ],
  },
});
