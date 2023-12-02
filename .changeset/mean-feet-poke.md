---
"anywidget": minor
---

Remove re-export of `@anywidget/vite` from main package

Breaking change. If using our Vite plugin, please make sure to install
`@anywidget/vite` (rather than importing from `anywidget` main package). This
change allows us to version the Vite plugin and anywidget's core separately.
