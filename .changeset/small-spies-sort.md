---
"create-anywidget": minor
---

feat: Support Bun and prefer built-in bundler over `esbuild`

When running `bun create anywidget@latest`, the resulting package.json scripts prefer the built-in bundler over esbuild. As a result, the vanilla JS template has no dependencies.

```sh
bun create anywidget@latest
```
