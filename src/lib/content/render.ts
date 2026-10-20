import {
  type ArticleDoc,
  type BlockNode,
  type InlineNode,
  type Mark,
  sanitizeDoc,
  type SanitizeOptions,
} from "./document";
import { parseYouTubeId } from "./urls";

/**
 * Tiptap JSON → HTML, used by the admin preview now and the public article
 * pages in Phase 4. Server-side by intent (it never needs to ship to the
 * browser); kept free of server-only imports so scripts can test it.
 *
 * Safety model:
 *  1. The input is re-sanitized here, so even rows written before a rule
 *     changed can't output disallowed nodes, marks or URLs.
 *  2. Every text node and attribute value is HTML-escaped.
 *  3. No raw HTML from the database is ever passed through.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function attr(name: string, value: string) {
  return ` ${name}="${escapeHtml(value)}"`;
}

function renderMarks(text: string, marks: Mark[] | undefined): string {
  let html = escapeHtml(text);
  // Apply innermost first; link wraps everything so the whole run is clickable.
  const ordered = [...(marks ?? []).filter((m) => m.type !== "link"), ...(marks ?? []).filter((m) => m.type === "link")];
  for (const mark of ordered) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "link": {
        const external = !mark.attrs.href.startsWith("mailto:");
        html = `<a${attr("href", mark.attrs.href)}${
          external ? ' target="_blank" rel="noopener noreferrer nofollow ugc"' : ""
        }>${html}</a>`;
        break;
      }
    }
  }
  return html;
}

function renderInline(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === "hardBreak" ? "<br>" : renderMarks(node.text, node.marks)))
    .join("");
}

function renderBlocks(nodes: BlockNode[]): string {
  return nodes.map(renderBlock).join("");
}

function renderBlock(node: BlockNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderInline(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${renderInline(node.content)}</h${node.attrs.level}>`;
    case "bulletList":
      return `<ul>${node.content.map((item) => `<li>${renderBlocks(item.content)}</li>`).join("")}</ul>`;
    case "orderedList":
      return `<ol${node.attrs.start !== 1 ? attr("start", String(node.attrs.start)) : ""}>${node.content
        .map((item) => `<li>${renderBlocks(item.content)}</li>`)
        .join("")}</ol>`;
    case "blockquote":
      return `<blockquote>${renderBlocks(node.content)}</blockquote>`;
    case "horizontalRule":
      return "<hr>";
    case "image":
      return `<figure class="kt-figure"><img${attr("src", node.attrs.src)}${attr("alt", node.attrs.alt)}${
        node.attrs.title ? attr("title", node.attrs.title) : ""
      } loading="lazy" decoding="async">${
        node.attrs.title ? `<figcaption>${escapeHtml(node.attrs.title)}</figcaption>` : ""
      }</figure>`;
    case "youtube": {
      const id = parseYouTubeId(node.attrs.src);
      if (!id) return "";
      const src = `https://www.youtube-nocookie.com/embed/${id}${node.attrs.start ? `?start=${node.attrs.start}` : ""}`;
      return `<div class="kt-embed kt-embed-youtube"><iframe${attr("src", src)} title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allowfullscreen></iframe></div>`;
    }
    case "tweet": {
      const handle = node.attrs.url.split("/")[3] ?? "";
      return `<aside class="kt-embed kt-embed-x" dir="ltr" lang="en"><span class="kt-embed-x-label">Post on X</span><a${attr(
        "href",
        node.attrs.url,
      )} target="_blank" rel="noopener noreferrer nofollow">@${escapeHtml(handle)} · View on X</a></aside>`;
    }
  }
}

/** Renders a stored Tiptap document to safe HTML. Returns "" for empty/invalid input. */
export function renderDocToHtml(input: unknown, options: SanitizeOptions): string {
  const { doc } = sanitizeDoc(input, options);
  return doc ? renderBlocks(doc.content) : "";
}

export type { ArticleDoc };
