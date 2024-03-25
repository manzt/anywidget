import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import ipynb from "./scripts/ipynb.mjs";

// TODO: remove or migrate entire to tailwind
import tailwind from "@astrojs/tailwind";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
	site: `https://anywidget.dev/`,
	prefetch: true,
	markdown: {
		shikiConfig: {
			theme: "poimandres",
		},
	},
	integrations: [
		// Enable Preact to support Preact JSX components.
		preact({
			exclude: ["./src/components/Header/Search.tsx"],
		}),
		// Enable React for the Algolia search component.
		react({
			include: ["./src/components/Header/Search.tsx"],
		}),
		// Support .ipynb pages
		ipynb({
			execute: false,
		}),
		// Added for custom landing page
		tailwind({
			config: {
				applyBaseStyles: false,
			},
		}),
		// Suports components in markdown
		mdx(),
		sitemap(),
	],
	image: {
		remotePatterns: [{ protocol: "https" }],
	},
});
