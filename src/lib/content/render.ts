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

/** Visible/accessible text the renderer adds around embeds; pass localized values on Urdu pages. */
export type EmbedLabels = { video: string; postOnX: string; viewOnX: string };

const DEFAULT_LABELS: EmbedLabels = { video: "YouTube video", postOnX: "Post on X", viewOnX: "View on X" };

export type RenderOptions = SanitizeOptions & { labels?: EmbedLabels };

function renderBlocks(nodes: BlockNode[], labels: EmbedLabels): string {
  return nodes.map((node) => renderBlock(node, labels)).join("");
}

function renderBlock(node: BlockNode, labels: EmbedLabels): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderInline(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${renderInline(node.content)}</h${node.attrs.level}>`;
    case "bulletList":
      return `<ul>${node.content.map((item) => `<li>${renderBlocks(item.content, labels)}</li>`).join("")}</ul>`;
    case "orderedList":
      return `<ol${node.attrs.start !== 1 ? attr("start", String(node.attrs.start)) : ""}>${node.content
        .map((item) => `<li>${renderBlocks(item.content, labels)}</li>`)
        .join("")}</ol>`;
    case "blockquote":
      return `<blockquote>${renderBlocks(node.content, labels)}</blockquote>`;
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
      return `<div class="kt-embed kt-embed-youtube"><iframe${attr("src", src)}${attr("title", labels.video)} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allowfullscreen></iframe></div>`;
    }
    case "tweet": {
      const handle = node.attrs.url.split("/")[3] ?? "";
      // The handle stays left-to-right inside its own <bdi>; the labels follow the page language.
      return `<aside class="kt-embed kt-embed-x"><span class="kt-embed-x-label">${escapeHtml(labels.postOnX)}</span><a${attr(
        "href",
        node.attrs.url,
      )} target="_blank" rel="noopener noreferrer nofollow"><bdi dir="ltr" lang="en">@${escapeHtml(handle)}</bdi> · ${escapeHtml(labels.viewOnX)}</a></aside>`;
    }
  }
}

/** Renders a stored Tiptap document to safe HTML. Returns "" for empty/invalid input. */
export function renderDocToHtml(input: unknown, options: RenderOptions): string {
  const { doc } = sanitizeDoc(input, options);
  return doc ? renderBlocks(doc.content, options.labels ?? DEFAULT_LABELS) : "";
}

/**
 * Same as renderDocToHtml, split into two safe halves at a top-level block
 * boundary: after the `paragraphs`-th top-level paragraph. Used to place an
 * element (the inline ad slot) inside an article without touching its HTML.
 * The second half is "" when the article is shorter than that.
 */
export function renderDocToHtmlParts(input: unknown, options: RenderOptions, paragraphs: number): [string, string] {
  const { doc } = sanitizeDoc(input, options);
  if (!doc) return ["", ""];
  let seen = 0;
  let split = doc.content.length;
  for (const [index, node] of doc.content.entries()) {
    if (node.type === "paragraph" && ++seen === paragraphs) {
      split = index + 1;
      break;
    }
  }
  const labels = options.labels ?? DEFAULT_LABELS;
  return [renderBlocks(doc.content.slice(0, split), labels), renderBlocks(doc.content.slice(split), labels)];
}

export type { ArticleDoc };
