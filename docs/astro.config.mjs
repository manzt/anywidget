import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

import ipynb from "./scripts/ipynb.mjs";

export default defineConfig({
	markdown: {
		shikiConfig: { theme: "poimandres" },
	},
	integrations: [
		preact(),
		react(),
		tailwind(),
		ipynb({ execute: false }),
	],
	site: `https://manzt.github.io`,
});
