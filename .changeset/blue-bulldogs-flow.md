---
"anywidget": patch
---

fix: disable auto-reloading in `dist-packages`

When the package is located in `dist-packages`, auto-reloading is now disabled.
This prevents unnecessary warnings when the package is used in environments like
Google Colab which are likely non-development installs.
