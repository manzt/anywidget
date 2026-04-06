import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
