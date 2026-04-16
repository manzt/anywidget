import type { AnyModel } from "@anywidget/types";
import * as solid from "solid-js";

export function observe<T extends Record<string, unknown>, K extends keyof T & string>(
  model: AnyModel<T>,
  name: K,
  { signal }: { signal?: AbortSignal },
): solid.Accessor<T[K]> {
  let [get, set] = solid.createSignal(model.get(name));
  let update = () => set(() => model.get(name));
  model.on(`change:${name}`, update);
  signal?.addEventListener("abort", () => {
    model.off(`change:${name}`, update);
  });
  return get;
}
