import type { AnyModel } from "@anywidget/types";
import * as uuid from "@lukeed/uuid";

export interface InvokeOptions {
  buffers?: DataView[];
  signal?: AbortSignal;
}

export function invoke<T>(
  model: AnyModel,
  name: string,
  msg?: unknown,
  options: InvokeOptions = {},
): Promise<[T, DataView[]]> {
  // crypto.randomUUID() is not available in non-secure contexts (i.e., http://)
  // so we use simple (non-secure) polyfill.
  let id = uuid.v4();
  let signal = options.signal ?? AbortSignal.timeout(3000);

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
    }
    signal.addEventListener("abort", () => {
      model.off("msg:custom", handler);
      reject(signal.reason);
    });

    function handler(
      msg: { id: string; kind: "anywidget-command-response"; response: T },
      buffers: DataView[],
    ): void {
      if (!(msg.id === id)) return;
      resolve([msg.response, buffers]);
      model.off("msg:custom", handler);
    }
    model.on("msg:custom", handler);
    model.send({ id, kind: "anywidget-command", name, msg }, undefined, options.buffers ?? []);
  });
}
