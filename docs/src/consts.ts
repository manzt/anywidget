export const SITE = {
	title: "anywidget",
	description: "custom jupyter widgets made easy",
	defaultLanguage: "en_US",
};

export const OPEN_GRAPH = {
	image: {
		// TODO: change to public/banner-minimal.png when repo is public
		src: "https://user-images.githubusercontent.com/24403730/212561522-74377f45-45fe-4d21-b40a-bb7099f710a9.png",
		alt: "anywidget logo on white background",
	},
	twitter: "trevmanz",
};

// This is the type of the frontmatter you put in the docs markdown files.
export type Frontmatter = {
	title: string;
	description: string;
	layout: string;
	image?: { src: string; alt: string };
	dir?: "ltr" | "rtl";
	ogLocale?: string;
	lang?: string;
	authors?: string[];
};

export const KNOWN_LANGUAGES = {
	English: "en",
} as const;
export const KNOWN_LANGUAGE_CODES = Object.values(KNOWN_LANGUAGES);

export const GITHUB_URL = `https://github.com/manzt/anywidget`;
export const GITHUB_EDIT_URL = `${GITHUB_URL}/tree/main/docs`;
export const COMMUNITY_INVITE_URL = "";

// See "Algolia" section of the README for more information.
export const ALGOLIA = {
	indexName: "anywidget",
	appId: "5UZQUZZNXI",
	apiKey: "f8be8ea567a2b746ccc3986f9db3a129",
};

export type Sidebar = Record<
	(typeof KNOWN_LANGUAGE_CODES)[number],
	Record<string, { text: string; link: string }[]>
>;
export const SIDEBAR: Sidebar = {
	en: {
		Guide: [
			{ text: "Getting Started", link: "en/getting-started" },
			{
				text: "Jupyter Widgets: The Good Parts",
				link: "en/jupyter-widgets-the-good-parts",
			},
			{ text: "Advanced: Bundling", link: "en/bundling" },
		],
		Notebooks: [
			{ text: "Build a Counter Widget", link: "en/notebooks/counter" },
		],
		Blog: [
			{ text: "Introducing anywidget", link: "blog/introducing-anywidget" },
			{ text: "Modern Web Meets Jupyter", link: "blog/anywidget-02" },
		],
	},
};
