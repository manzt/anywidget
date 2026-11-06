import * as widgets from "@jupyter-widgets/base";
import { expect, it, vi } from "vitest";

import { getDefinition } from "../src/definition.ts";

declare global {
  var __anywidgetEvaluations: number | undefined;
}

/** A module that counts how many times it has been evaluated. */
function countingEsm(label: string): string {
  return `\
globalThis.__anywidgetEvaluations = (globalThis.__anywidgetEvaluations ?? 0) + 1;
export default { render({ el }) { el.innerText = ${JSON.stringify(label)}; } };
`;
}

function evaluations(): number {
  return globalThis.__anywidgetEvaluations ?? 0;
}

let ids = 0;
function createOwner(state: Record<string, unknown>): widgets.WidgetModel {
  return new widgets.WidgetModel(state, { model_id: `owner-${ids++}` });
}

async function ready(definition: ReturnType<typeof getDefinition>) {
  await vi.waitFor(() => expect(definition.widget().status).toBe("ready"));
  let result = definition.widget();
  if (result.status !== "ready") throw new Error("unreachable");
  return result.data;
}

it("evaluates a source once per owner and attribute", async () => {
  let before = evaluations();
  let owner = createOwner({ _esm: countingEsm("a") });

  let definition = getDefinition(owner, "_esm");
  let widget = await ready(definition);

  expect(typeof widget.render).toBe("function");
  expect(evaluations()).toBe(before + 1);
  expect(getDefinition(owner, "_esm")).toBe(definition);
  await Promise.resolve();
  expect(evaluations()).toBe(before + 1);
});

it("keeps distinct owners separate", async () => {
  let before = evaluations();
  let esm = countingEsm("b");
  let first = getDefinition(createOwner({ _esm: esm }), "_esm");
  let second = getDefinition(createOwner({ _esm: esm }), "_esm");

  expect(first).not.toBe(second);
  expect(await ready(first)).not.toBe(await ready(second));
  expect(evaluations()).toBe(before + 2);
});

it("re-evaluates when the source changes and keeps the old definition until then", async () => {
  let owner = createOwner({ _esm: countingEsm("c1") });
  let definition = getDefinition(owner, "_esm");
  let first = await ready(definition);
  let before = evaluations();

  owner.set("_esm", countingEsm("c2"));
  // Still the previous definition until the new module has loaded.
  expect(definition.widget()).toEqual({ status: "ready", data: first });

  await vi.waitFor(() => {
    let result = definition.widget();
    expect(result.status === "ready" && result.data !== first).toBe(true);
  });
  expect(evaluations()).toBe(before + 1);
});

it("reports a module that fails to load", async () => {
  let owner = createOwner({ _esm: 'throw new Error("boom");' });
  let definition = getDefinition(owner, "_esm");

  await vi.waitFor(() => expect(definition.widget().status).toBe("error"));
});

it("forgets the owner on destroy", async () => {
  let owner = createOwner({ _esm: countingEsm("d") });
  let definition = getDefinition(owner, "_esm");
  await ready(definition);
  let before = evaluations();

  owner.trigger("destroy");
  owner.set("_esm", countingEsm("d2"));
  await Promise.resolve();

  // No reload after dispose, and the next lookup starts fresh.
  expect(evaluations()).toBe(before);
  expect(getDefinition(owner, "_esm")).not.toBe(definition);
});
