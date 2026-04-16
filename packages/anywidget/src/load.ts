import type { Initialize, Render } from "@anywidget/types";

import { assert } from "./util.ts";

export interface AnyWidget {
  initialize?: Initialize;
  render?: Render;
}

export interface AnyWidgetModule {
  render?: Render;
  default?: AnyWidget | (() => AnyWidget | Promise<AnyWidget>);
}

function isHref(str: string): str is `https://${string}` | `http://${string}` {
  return str.startsWith("http://") || str.startsWith("https://");
}

async function loadCssHref(href: string, anywidgetId: string): Promise<void> {
  let prev = document.querySelector<HTMLLinkElement>(`link[id='${anywidgetId}']`);

  // Adapted from https://github.com/vitejs/vite/blob/d59e1acc2efc0307488364e9f2fad528ec57f204/packages/vite/src/client/client.ts#L185-L201
  // Swaps out old styles with new, but avoids flash of unstyled content.
  // No need to await the load since we already have styles applied.
  if (prev) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Node.cloneNode() returns Node; we know prev is HTMLLinkElement so the clone is too
    let newLink = prev.cloneNode() as unknown as HTMLLinkElement;
    newLink.href = href;
    newLink.addEventListener("load", () => prev?.remove());
    newLink.addEventListener("error", () => prev?.remove());
    prev.after(newLink);
    return;
  }

  return new Promise((resolve) => {
    let link = Object.assign(document.createElement("link"), {
      rel: "stylesheet",
      href,
      onload: resolve,
    });
    document.head.appendChild(link);
  });
}

function loadCssText(cssText: string, anywidgetId: string): void {
  let prev = document.querySelector<HTMLStyleElement>(`style[id='${anywidgetId}']`);
  if (prev) {
    // replace instead of creating a new DOM node
    prev.textContent = cssText;
    return;
  }
  let style = Object.assign(document.createElement("style"), {
    id: anywidgetId,
    type: "text/css",
  });
  style.appendChild(document.createTextNode(cssText));
  document.head.appendChild(style);
}

export async function loadCss(css: string | undefined, anywidgetId: string): Promise<void> {
  if (!css || !anywidgetId) return;
  if (isHref(css)) return loadCssHref(css, anywidgetId);
  return loadCssText(css, anywidgetId);
}

async function loadEsm(esm: string): Promise<AnyWidgetModule> {
  if (isHref(esm)) {
    return await import(/* webpackIgnore: true */ /* @vite-ignore */ esm);
  }
  let url = URL.createObjectURL(new Blob([esm], { type: "text/javascript" }));
  let mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ url);
  URL.revokeObjectURL(url);
  return mod;
}

function warnRenderDeprecation(anywidgetId: string): void {
  console.warn(`\
[anywidget] Deprecation Warning for ${anywidgetId}: Direct export of a 'render' will likely be deprecated in the future. To migrate ...

Remove the 'export' keyword from 'render'
-----------------------------------------

export function render({ model, el }) { ... }
^^^^^^

Create a default export that returns an object with 'render'
------------------------------------------------------------

function render({ model, el }) { ... }
         ^^^^^^
export default { render }
                 ^^^^^^

Pin to anywidget>=0.9.0 in your pyproject.toml
----------------------------------------------

dependencies = ["anywidget>=0.9.0"]

To learn more, please see: https://github.com/manzt/anywidget/pull/395.
`);
}

export async function loadWidget(esm: string, anywidgetId: string): Promise<AnyWidget> {
  let mod = await loadEsm(esm);
  if (mod.render) {
    warnRenderDeprecation(anywidgetId);
    return {
      async initialize() {},
      render: mod.render,
    };
  }
  assert(mod.default, `[anywidget] module must export a default function or object.`);
  let widget = typeof mod.default === "function" ? await mod.default() : mod.default;
  return widget;
}
