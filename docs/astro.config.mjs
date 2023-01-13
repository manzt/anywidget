import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import react from "@astrojs/react";
import ipynb from "./scripts/ipynb.mjs";

// https://astro.build/config
export default defineConfig({
	markdown: {
		shikiConfig: { theme: "poimandres" },
	},
	integrations: [
		// Enable Preact to support Preact JSX components.
		preact(),
		// Enable React for the Algolia search component.
		react(),
		// Support .ipynb pages
		ipynb({ execute: true }),
	],
	site: `https://astro.build`,
});
