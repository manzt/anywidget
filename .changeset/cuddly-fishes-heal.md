---
"anywidget": patch
---

Relax version pinning for anywidget front end

Adopted `~major.minor.*` notation for more flexible version compatibility in the front end, mirroring practices improve compatability in environments where bumping the front-end versions is not possible for end users (i.e., JupyterHub). This change is intended to enhance adaptability without causing disruptions. If issues arise, please report them on our issues page.
