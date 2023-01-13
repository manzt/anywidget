const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,html,js,jsx,md,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				neutral: colors.slate,
				primary: colors.teal,
				secondary: colors.orange,
				accent: colors.gray,
			},
			screens: {
				xs: "420px",
			},
		},
	},
};
