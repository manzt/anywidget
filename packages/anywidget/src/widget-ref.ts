export let WIDGET_REF_PREFIX = "anywidget:";

export function parseWidgetRef(ref: unknown): string {
  if (typeof ref === "string" && ref.startsWith(WIDGET_REF_PREFIX)) {
    return ref.slice(WIDGET_REF_PREFIX.length);
  }
  throw new Error(`[anywidget] Invalid widget reference: ${JSON.stringify(ref)}`);
}
