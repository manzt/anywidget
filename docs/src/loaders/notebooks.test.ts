import { describe, expect, test } from "vitest";

import {
  joinSource,
  notebookToMarkdown,
  outputToHtml,
  serializeScriptData,
  type Notebook,
} from "./notebook";

function notebook(cells: Notebook["cells"], metadata: Notebook["metadata"] = {}): Notebook {
  return { cells, metadata, nbformat: 4, nbformat_minor: 5 };
}

describe("notebook content", () => {
  test("joins string and array sources", () => {
    expect(joinSource("one")).toBe("one");
    expect(joinSource(["one", "\n", "two"])).toBe("one\ntwo");
  });

  test("converts frontmatter, markdown, raw, and code cells", () => {
    const result = notebookToMarkdown(
      notebook(
        [
          { cell_type: "raw", source: ["---\n", "title: Example\n", "description: Test\n", "---"] },
          { cell_type: "markdown", source: "## Heading" },
          { cell_type: "raw", source: "plain" },
          { cell_type: "code", source: "print(`value`)", outputs: [] },
        ],
        { language_info: { name: "python" } },
      ),
    );

    expect(result).toContain("---\ntitle: Example\ndescription: Test\n---");
    expect(result).toContain("## Heading");
    expect(result).toContain("```\nplain\n```");
    expect(result).toContain("```python\nprint(`value`)\n```");
  });

  test("renders saved widget state and matching widget views", () => {
    const widgetState = {
      version_major: 2,
      version_minor: 0,
      state: { model: {} },
    };
    const result = notebookToMarkdown(
      notebook(
        [
          {
            cell_type: "code",
            source: "widget",
            outputs: [
              {
                output_type: "execute_result",
                data: {
                  "application/vnd.jupyter.widget-view+json": { model_id: "model" },
                  "text/plain": "Widget()",
                },
              },
            ],
          },
        ],
        {
          widgets: { "application/vnd.jupyter.widget-state+json": widgetState },
        },
      ),
    );

    expect(result).toContain("@jupyter-widgets/html-manager");
    expect(result).toContain("data-jupyter-widgets-cdn-only");
    expect(result).toContain('type="application/vnd.jupyter.widget-state+json"');
    expect(result).toContain('type="application/vnd.jupyter.widget-view+json"');
    expect(result).not.toContain("Widget()");
  });

  test("falls back to escaped text when widget state is missing", () => {
    const html = outputToHtml(
      {
        output_type: "display_data",
        data: {
          "application/vnd.jupyter.widget-view+json": { model_id: "missing" },
          "text/plain": ["<Widget", " />"],
        },
      },
      new Set(),
    );
    expect(html).toBe("<pre>&lt;Widget /&gt;</pre>");
  });

  test("renders streams and errors safely", () => {
    expect(outputToHtml({ output_type: "stream", text: ["one", "<two>"] }, new Set())).toBe(
      "<pre>one&lt;two&gt;</pre>",
    );
    expect(outputToHtml({ output_type: "error", traceback: ["Error", "<trace>"] }, new Set())).toBe(
      "<pre>Error\n&lt;trace&gt;</pre>",
    );
  });

  test("escapes script-closing data", () => {
    expect(serializeScriptData({ value: "</script>" })).toBe('{"value":"\\u003c/script>"}');
  });
});
