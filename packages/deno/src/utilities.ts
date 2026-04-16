/**
 * Removes Uint8Array values from the top-level keys of an object, replacing them with null.
 *
 * @param state - The input state object containing potential Uint8Array values.
 * The modified (JSON-serializable) state, extracted buffers, and buffer paths.
 */
export function removeBuffers<T extends Record<string, unknown>>(
  state: T,
): {
  state: { [K in keyof T]: T[K] extends Uint8Array ? null : T[K] };
  buffers: Array<Uint8Array>;
  bufferPaths: Array<[string]>;
} {
  let buffers: Array<Uint8Array> = [];
  let bufferPaths: Array<[string]> = [];
  let out: Record<string, unknown> = {};
  for (let key in state) {
    if (state[key] instanceof Uint8Array) {
      out[key] = null;
      buffers.push(state[key]);
      bufferPaths.push([key]);
    } else {
      out[key] = state[key];
    }
  }
  return {
    // @ts-expect-error - we know the type
    state: out,
    buffers,
    bufferPaths,
  };
}
