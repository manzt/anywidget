const WIDGET_VIEW_MIMETYPE = "application/vnd.jupyter.widget-view+json";
const WIDGET_STATE_MIMETYPE = "application/vnd.jupyter.widget-state+json";

type MultilineString = string | string[];
type MimeBundle = Record<string, unknown>;

type NotebookOutput = {
  output_type: "display_data" | "error" | "execute_result" | "stream";
  data?: MimeBundle;
  text?: MultilineString;
  traceback?: string[];
};

type NotebookCell = {
  cell_type: "code" | "markdown" | "raw";
  source: MultilineString;
  attachments?: Record<string, MimeBundle>;
  outputs?: NotebookOutput[];
};

type WidgetState = {
  state: Record<string, unknown>;
  version_major: number;
  version_minor: number;
};

export type Notebook = {
  cells: NotebookCell[];
  metadata: {
    language_info?: { name?: string };
    widgets?: { [WIDGET_STATE_MIMETYPE]?: WidgetState };
  };
  nbformat: number;
  nbformat_minor: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMultilineString(value: unknown): value is MultilineString {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((part) => typeof part === "string"))
  );
}

function isNotebookCell(value: unknown): value is NotebookCell {
  return (
    isRecord(value) &&
    (value.cell_type === "code" || value.cell_type === "markdown" || value.cell_type === "raw") &&
    isMultilineString(value.source)
  );
}

export function isNotebook(value: unknown): value is Notebook {
  return (
    isRecord(value) &&
    value.nbformat === 4 &&
    typeof value.nbformat_minor === "number" &&
    Array.isArray(value.cells) &&
    value.cells.every(isNotebookCell) &&
    isRecord(value.metadata)
  );
}

export function joinSource(source: MultilineString | undefined): string {
  if (!source) return "";
  return Array.isArray(source) ? source.join("") : source;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function serializeScriptData(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function mimeString(data: MimeBundle | undefined, mime: string): string | undefined {
  const value = data?.[mime];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) {
    return value.join("");
  }
  return undefined;
}

function fenced(source: string, language = ""): string {
  const longestRun = Math.max(0, ...Array.from(source.matchAll(/`+/g), ({ 0: run }) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${source}\n${fence}`;
}

function imageDataUrl(mime: string, value: string): string {
  return mime === "image/svg+xml"
    ? `data:${mime},${encodeURIComponent(value)}`
    : `data:${mime};base64,${value}`;
}

function attachmentUrl(bundle: MimeBundle): string | undefined {
  for (const mime of ["image/png", "image/jpeg", "image/gif", "image/svg+xml"]) {
    const value = mimeString(bundle, mime);
    if (value) return imageDataUrl(mime, value);
  }
  return undefined;
}

function resolveAttachments(source: string, attachments: NotebookCell["attachments"]): string {
  if (!attachments) return source;
  return source.replaceAll(/attachment:([^\s)"']+)/g, (match, name: string) => {
    const url = attachmentUrl(attachments[name] ?? {});
    return url ?? match;
  });
}

export function outputToHtml(output: NotebookOutput, widgetStateIds: Set<string>): string {
  if (output.output_type === "stream") {
    return `<pre>${escapeHtml(joinSource(output.text))}</pre>`;
  }

  if (output.output_type === "error") {
    return `<pre>${escapeHtml((output.traceback ?? []).join("\n"))}</pre>`;
  }

  const widgetView = output.data?.[WIDGET_VIEW_MIMETYPE];
  if (
    widgetView &&
    typeof widgetView === "object" &&
    "model_id" in widgetView &&
    typeof widgetView.model_id === "string" &&
    widgetStateIds.has(widgetView.model_id)
  ) {
    return `<div class="jupyter-widgets jp-OutputArea-output jp-OutputArea-executeResult"><script type="${WIDGET_VIEW_MIMETYPE}">${serializeScriptData(widgetView)}</script></div>`;
  }

  const html = mimeString(output.data, "text/html");
  if (html) return html;

  for (const mime of ["image/png", "image/jpeg", "image/gif", "image/svg+xml"]) {
    const value = mimeString(output.data, mime);
    if (value) return `<img src="${imageDataUrl(mime, value)}" alt="Notebook output" />`;
  }

  const text = mimeString(output.data, "text/plain");
  return text ? `<pre>${escapeHtml(text)}</pre>` : "";
}

function widgetClientHtml(widgetState: WidgetState): string {
  return `<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js" integrity="sha256-Ae2Vz/4ePdIu6ZyI/5ZGsYnb+m0JlOmKPjt6XZ9JJkA=" crossorigin="anonymous"></script>
<script data-jupyter-widgets-cdn="https://cdn.jsdelivr.net/npm/" data-jupyter-widgets-cdn-only src="https://cdn.jsdelivr.net/npm/@jupyter-widgets/html-manager@*/dist/embed-amd.js" crossorigin="anonymous"></script>
<script type="${WIDGET_STATE_MIMETYPE}">${serializeScriptData(widgetState)}</script>`;
}

export function notebookToMarkdown(notebook: Notebook): string {
  const cells = [...notebook.cells];
  const firstCell = cells[0];
  const firstSource = joinSource(firstCell?.source);
  const frontmatter =
    firstCell?.cell_type === "raw" && /^---\s*(?:\r?\n)/.test(firstSource)
      ? joinSource(cells.shift()?.source)
      : "";
  const widgetState = notebook.metadata.widgets?.[WIDGET_STATE_MIMETYPE];
  const widgetStateIds = new Set(Object.keys(widgetState?.state ?? {}));
  const language = notebook.metadata.language_info?.name ?? "python";
  const sections: string[] = [];

  if (frontmatter) sections.push(frontmatter);
  if (widgetState) sections.push(widgetClientHtml(widgetState));

  for (const cell of cells) {
    const source = joinSource(cell.source);
    if (cell.cell_type === "markdown") {
      sections.push(resolveAttachments(source, cell.attachments));
      continue;
    }
    if (cell.cell_type === "raw") {
      sections.push(fenced(source));
      continue;
    }

    sections.push(fenced(source, language));
    const outputs = (cell.outputs ?? [])
      .map((output) => outputToHtml(output, widgetStateIds))
      .filter(Boolean);
    sections.push(...outputs);
  }

  return `${sections.join("\n\n")}\n`;
}
