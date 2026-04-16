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

function is_href(str: string): str is `https://${string}` | `http://${string}` {
  return str.startsWith("http://") || str.startsWith("https://");
}

async function load_css_href(href: string, anywidget_id: string): Promise<void> {
  let prev = document.querySelector<HTMLLinkElement>(`link[id='${anywidget_id}']`);

  // Adapted from https://github.com/vitejs/vite/blob/d59e1acc2efc0307488364e9f2fad528ec57f204/packages/vite/src/client/client.ts#L185-L201
  // Swaps out old styles with new, but avoids flash of unstyled content.
  // No need to await the load since we already have styles applied.
  if (prev) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Node.cloneNode() returns Node; we know prev is HTMLLinkElement so the clone is too
    let newLink = prev.cloneNode() as HTMLLinkElement;
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

function load_css_text(css_text: string, anywidget_id: string): void {
  let prev = document.querySelector<HTMLStyleElement>(`style[id='${anywidget_id}']`);
  if (prev) {
    // replace instead of creating a new DOM node
    prev.textContent = css_text;
    return;
  }
  let style = Object.assign(document.createElement("style"), {
    id: anywidget_id,
    type: "text/css",
  });
  style.appendChild(document.createTextNode(css_text));
  document.head.appendChild(style);
}

export async function load_css(css: string | undefined, anywidget_id: string): Promise<void> {
  if (!css || !anywidget_id) return;
  if (is_href(css)) return load_css_href(css, anywidget_id);
  return load_css_text(css, anywidget_id);
}

async function load_esm(esm: string): Promise<AnyWidgetModule> {
  if (is_href(esm)) {
    return await import(/* webpackIgnore: true */ /* @vite-ignore */ esm);
  }
  let url = URL.createObjectURL(new Blob([esm], { type: "text/javascript" }));
  let mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ url);
  URL.revokeObjectURL(url);
  return mod;
}

function warn_render_deprecation(anywidget_id: string): void {
  console.warn(`\
[anywidget] Deprecation Warning for ${anywidget_id}: Direct export of a 'render' will likely be deprecated in the future. To migrate ...

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

export async function load_widget(esm: string, anywidget_id: string): Promise<AnyWidget> {
  let mod = await load_esm(esm);
  if (mod.render) {
    warn_render_deprecation(anywidget_id);
    return {
      async initialize() {},
      render: mod.render,
    };
  }
  assert(mod.default, `[anywidget] module must export a default function or object.`);
  let widget = typeof mod.default === "function" ? await mod.default() : mod.default;
  return widget;
}
