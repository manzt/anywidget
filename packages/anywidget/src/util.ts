export type Awaitable<T> = T | PromiseLike<T>;

export interface Ready<T> {
  status: "ready";
  data: T;
}

export interface Pending {
  status: "pending";
}

export interface Errored {
  status: "error";
  error: unknown;
}

export type Result<T> = Pending | Ready<T> | Errored;

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function safe_cleanup(
  fn: void | (() => Awaitable<void>) | undefined,
  kind: string,
): Promise<void> {
  return Promise.resolve()
    .then(() => fn?.())
    .catch((e) => console.warn(`[anywidget] error cleaning up ${kind}.`, e));
}

/**
 * Cleans up the stack trace at anywidget boundary.
 * You can fully inspect the entire stack trace in the console interactively,
 * but the initial error message is cleaned up to be more user-friendly.
 */
export function throw_anywidget_error(source: unknown): never {
  if (!(source instanceof Error)) {
    // Don't know what to do with this.
    throw source;
  }
  let lines = source.stack?.split("\n") ?? [];
  let anywidget_index = lines.findIndex((line) => line.includes("anywidget"));
  let clean_stack = anywidget_index === -1 ? lines : lines.slice(0, anywidget_index + 1);
  source.stack = clean_stack.join("\n");
  console.error(source);
  throw source;
}

/**
 * Polyfill for {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers Promise.withResolvers}
 *
 * Trevor(2025-03-14): Should be able to remove once more stable across browsers.
 */
export function promise_with_resolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  let promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
