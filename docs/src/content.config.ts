import { defineCollection, z } from "astro:content";

import { notebookLoader } from "./loaders/notebooks";

const notebooks = defineCollection({
  loader: notebookLoader({ base: "./public/notebooks" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    sourcePath: z.string(),
    image: z.object({ src: z.string(), alt: z.string() }).optional(),
    dir: z.enum(["ltr", "rtl"]).optional(),
    ogLocale: z.string().optional(),
    lang: z.string().optional(),
    authors: z.array(z.string()).optional(),
  }),
});

export const collections = { notebooks };
