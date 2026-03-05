/**
 * Utilities for converting legacy Plate.js JSON content to plain Markdown text.
 * Used by both the markdown editor (to initialize from legacy data) and the viewer (to render it).
 */

export function extractPlainText(json: string): string | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      const text = extractTextFromNodes(parsed);
      return text.trim() || null;
    }
    return null;
  } catch {
    return json.trim() || null;
  }
}

export function extractTextFromNodes(nodes: unknown[]): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const n = node as Record<string, unknown>;
    if (typeof n.text === "string") {
      lines.push(n.text);
      continue;
    }
    const children = n.children as unknown[] | undefined;
    const text = children ? extractTextFromNodes(children) : "";
    switch (n.type) {
      case "h1":
        lines.push(`# ${text}`);
        break;
      case "h2":
        lines.push(`## ${text}`);
        break;
      case "h3":
        lines.push(`### ${text}`);
        break;
      case "blockquote":
        lines.push(`> ${text}`);
        break;
      case "li":
      case "lic":
        lines.push(text);
        break;
      case "ul":
        lines.push(
          text
            .split("\n")
            .map((l) => `- ${l}`)
            .join("\n")
        );
        break;
      case "ol":
        lines.push(
          text
            .split("\n")
            .map((l, i) => `${i + 1}. ${l}`)
            .join("\n")
        );
        break;
      case "hr":
        lines.push("---");
        break;
      default:
        lines.push(text);
    }
  }
  return lines.join("\n");
}
