"use client";

import { useMemo } from "react";
import { extractPlainText } from "@/lib/plate-utils";

interface RichTextViewerProps {
  content: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Order matters: bold+italic (***) before bold (**) before italic (*)
function renderInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm">$1</code>');
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/~~(.+?)~~/g, "<s>$1</s>");
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return result;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inList = false;
  let listType = "";
  let inCodeBlock = false;
  const codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push(
          `<pre class="rounded-md bg-muted p-3 text-sm overflow-x-auto"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
        );
        codeLines.length = 0;
        inCodeBlock = false;
      } else {
        if (inList) {
          html.push(listType === "ul" ? "</ul>" : "</ol>");
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      if (inList) {
        html.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      html.push('<hr class="my-4 border-border" />');
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (inList) {
        html.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      const level = headingMatch[1].length;
      const text = renderInline(headingMatch[2]);
      const classes = [
        "mb-2 text-2xl font-bold",
        "mb-2 text-xl font-semibold",
        "mb-1 text-lg font-medium",
      ][level - 1];
      html.push(`<h${level} class="${classes}">${text}</h${level}>`);
      continue;
    }

    if (line.startsWith("> ")) {
      if (inList) {
        html.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      html.push(
        `<blockquote class="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground">${renderInline(line.slice(2))}</blockquote>`
      );
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) html.push(listType === "ul" ? "</ul>" : "</ol>");
        html.push('<ul class="list-disc pl-6">');
        inList = true;
        listType = "ul";
      }
      html.push(`<li class="my-0.5">${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) html.push(listType === "ul" ? "</ul>" : "</ol>");
        html.push('<ol class="list-decimal pl-6">');
        inList = true;
        listType = "ol";
      }
      html.push(`<li class="my-0.5">${renderInline(olMatch[1])}</li>`);
      continue;
    }

    if (inList) {
      html.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }

    if (!line.trim()) continue;

    html.push(`<p class="my-1">${renderInline(line)}</p>`);
  }

  if (inList) {
    html.push(listType === "ul" ? "</ul>" : "</ol>");
  }
  if (inCodeBlock) {
    html.push(
      `<pre class="rounded-md bg-muted p-3 text-sm overflow-x-auto"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
    );
  }

  return html.join("\n");
}

export function RichTextViewer({ content }: RichTextViewerProps) {
  const html = useMemo(() => {
    const text = extractPlainText(content);
    if (!text) return null;
    return markdownToHtml(text);
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
