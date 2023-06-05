const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
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
