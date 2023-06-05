import * as colors from "tailwindcss/colors.js";

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				primary: colors.teal,
				secondary: colors.orange,
				accent: colors.sky,
			},
			screens: { xs: "420px" },
		},
	},
	plugins: [],
};
