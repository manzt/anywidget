# anywidget documentation

The site is a custom [Astro](https://astro.build) documentation site styled
with Tailwind CSS.

From the repository root:

```bash
pnpm --filter @anywidget/docs dev
pnpm --filter @anywidget/docs check
pnpm --filter @anywidget/docs build
```

Pages live in `src/pages`, shared layouts in `src/layouts`, and navigation and
site metadata in `src/consts.ts`. Use Tailwind utilities for component styling;
global document styles and theme tokens live in `src/styles`.

Notebooks in `public/notebooks` are both downloadable and rendered as pages by
the custom content loader in `src/loaders/notebooks.ts`.
