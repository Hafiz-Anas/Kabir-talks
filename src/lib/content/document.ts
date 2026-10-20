import {
  normalizeXStatusUrl,
  parseYouTubeId,
  parseYouTubeStart,
  safeImageSrc,
  safeLinkHref,
  youTubeWatchUrl,
} from "./urls";

/**
 * Tiptap / ProseMirror JSON allow-list.
 *
 * The editor toolbar can only produce the nodes and marks listed here. The
 * server runs `sanitizeDoc` on every save and the renderer runs it again
 * before output, so anything else (pasted HTML, crafted requests) is dropped.
 * Pure module: safe to import on client and server.
 */

export type Mark =
  | { type: "bold" | "italic" | "underline" | "strike" }
  | { type: "link"; attrs: { href: string } };

export type InlineNode = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };

export type BlockNode =
  | { type: "paragraph"; content?: InlineNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: InlineNode[] }
  | { type: "bulletList"; content: ListItemNode[] }
  | { type: "orderedList"; attrs: { start: number }; content: ListItemNode[] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: { src: string; alt: string; title: string | null } }
  | { type: "youtube"; attrs: { src: string; start: number | null } }
  | { type: "tweet"; attrs: { url: string } };

export type ListItemNode = { type: "listItem"; content: BlockNode[] };

export type ArticleDoc = { type: "doc"; content: BlockNode[] };

export const ALLOWED_NODES = [
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "image",
  "youtube",
  "tweet",
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "underline", "strike", "link"] as const;

export type SanitizeOptions = {
  /** Public Storage prefix images must live under (see storagePublicPrefix). */
  imagePrefix: string | null;
};

export type SanitizeResult = {
  /** Clean document, or null when nothing meaningful is left. */
  doc: ArticleDoc | null;
  /** Human-readable list of what was removed (deduplicated). */
  removed: string[];
};

const MAX_DEPTH = 12;
const MAX_NODES = 20_000;
const MAX_TEXT = 20_000;

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function sanitizeDoc(input: unknown, options: SanitizeOptions): SanitizeResult {
  const removed = new Set<string>();
  let budget = MAX_NODES;

  const children = (node: Raw): unknown[] => (Array.isArray(node.content) ? node.content : []);

  function marks(raw: unknown): Mark[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const out: Mark[] = [];
    const seen = new Set<string>();
    for (const mark of raw) {
      if (!isObject(mark) || typeof mark.type !== "string") continue;
      if (seen.has(mark.type)) continue;
      switch (mark.type) {
        case "bold":
        case "italic":
        case "underline":
        case "strike":
          out.push({ type: mark.type });
          seen.add(mark.type);
          break;
        case "link": {
          const href = safeLinkHref(isObject(mark.attrs) ? mark.attrs.href : undefined);
          if (href) {
            out.push({ type: "link", attrs: { href } });
            seen.add("link");
          } else {
            removed.add("unsafe or invalid link");
          }
          break;
        }
        default:
          removed.add(`formatting "${mark.type}"`);
      }
    }
    return out.length ? out : undefined;
  }

  function inline(raw: unknown[]): InlineNode[] {
    const out: InlineNode[] = [];
    for (const node of raw) {
      if (--budget < 0 || !isObject(node)) continue;
      if (node.type === "text" && typeof node.text === "string" && node.text.length > 0) {
        const m = marks(node.marks);
        out.push({ type: "text", text: node.text.slice(0, MAX_TEXT), ...(m ? { marks: m } : {}) });
      } else if (node.type === "hardBreak") {
        out.push({ type: "hardBreak" });
      } else {
        removed.add(`inline content "${String(node.type)}"`);
      }
    }
    return out;
  }

  function listItems(raw: unknown[], depth: number): ListItemNode[] {
    const out: ListItemNode[] = [];
    for (const node of raw) {
      if (--budget < 0 || !isObject(node)) continue;
      if (node.type !== "listItem") {
        removed.add(`list content "${String(node.type)}"`);
        continue;
      }
      let content = blocks(children(node), depth + 1);
      if (!content.length || content[0].type !== "paragraph") {
        content = [{ type: "paragraph" }, ...content];
      }
      out.push({ type: "listItem", content });
    }
    return out;
  }

  function blocks(raw: unknown[], depth: number): BlockNode[] {
    const out: BlockNode[] = [];
    if (depth > MAX_DEPTH) {
      removed.add("content nested too deeply");
      return out;
    }
    for (const node of raw) {
      if (--budget < 0 || !isObject(node)) continue;
      const attrs = isObject(node.attrs) ? node.attrs : {};

      switch (node.type) {
        case "paragraph": {
          const content = inline(children(node));
          out.push(content.length ? { type: "paragraph", content } : { type: "paragraph" });
          break;
        }
        case "heading": {
          const requested = Number(attrs.level);
          const level: 2 | 3 = requested <= 2 ? 2 : 3;
          const content = inline(children(node));
          out.push({ type: "heading", attrs: { level }, ...(content.length ? { content } : {}) });
          break;
        }
        case "bulletList":
        case "orderedList": {
          const items = listItems(children(node), depth);
          if (!items.length) break;
          if (node.type === "bulletList") {
            out.push({ type: "bulletList", content: items });
          } else {
            const start = Number.parseInt(String(attrs.start ?? 1), 10);
            out.push({
              type: "orderedList",
              attrs: { start: Number.isFinite(start) && start > 0 && start < 10_000 ? start : 1 },
              content: items,
            });
          }
          break;
        }
        case "blockquote": {
          const content = blocks(children(node), depth + 1);
          if (content.length) out.push({ type: "blockquote", content });
          break;
        }
        case "horizontalRule":
          out.push({ type: "horizontalRule" });
          break;
        case "image": {
          const src = safeImageSrc(attrs.src, options.imagePrefix);
          const alt = typeof attrs.alt === "string" ? attrs.alt.trim().slice(0, 300) : "";
          if (!src) {
            removed.add("image not uploaded through Kabir Talks");
            break;
          }
          if (!alt) {
            removed.add("image without alt text");
            break;
          }
          const title = typeof attrs.title === "string" && attrs.title.trim() ? attrs.title.trim().slice(0, 300) : null;
          out.push({ type: "image", attrs: { src, alt, title } });
          break;
        }
        case "youtube": {
          const id = parseYouTubeId(attrs.src);
          if (!id) {
            removed.add("invalid YouTube embed");
            break;
          }
          const start = Number.isFinite(Number(attrs.start)) && Number(attrs.start) > 0
            ? Math.floor(Number(attrs.start))
            : (parseYouTubeStart(attrs.src) ?? null);
          out.push({ type: "youtube", attrs: { src: youTubeWatchUrl(id), start } });
          break;
        }
        case "tweet": {
          const url = normalizeXStatusUrl(attrs.url);
          if (!url) {
            removed.add("invalid X/Twitter embed");
            break;
          }
          out.push({ type: "tweet", attrs: { url } });
          break;
        }
        default:
          removed.add(`block "${String(node.type)}"`);
      }
    }
    return out;
  }

  if (!isObject(input) || input.type !== "doc") {
    return { doc: null, removed: input == null ? [] : ["invalid document"] };
  }

  const content = blocks(children(input), 0);
  if (budget < 0) removed.add("document too large (content truncated)");

  const doc: ArticleDoc = { type: "doc", content };
  return { doc: isDocEmpty(doc) ? null : doc, removed: [...removed] };
}

/** Plain text of a document (block boundaries become newlines). */
export function docToPlainText(doc: ArticleDoc | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (nodes: unknown[] | undefined) => {
    for (const node of nodes ?? []) {
      if (!isObject(node)) continue;
      if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
      else if (node.type === "hardBreak") parts.push("\n");
      if (Array.isArray(node.content)) {
        walk(node.content);
        if (node.type !== "listItem") parts.push("\n");
      }
    }
  };
  walk(doc.content);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));
  return words.length;
}

/** Minutes at ~200 wpm (English) / ~170 wpm (Urdu), minimum 1 when there is any text. */
export function readingMinutes(words: number, locale: "en" | "ur"): number {
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / (locale === "ur" ? 170 : 200)));
}

/** True when the document has no text and no media. */
export function isDocEmpty(doc: ArticleDoc | null | undefined): boolean {
  if (!doc) return true;
  const hasContent = (nodes: unknown[] | undefined): boolean =>
    (nodes ?? []).some((node) => {
      if (!isObject(node)) return false;
      if (node.type === "text") return typeof node.text === "string" && node.text.trim().length > 0;
      if (["image", "youtube", "tweet"].includes(String(node.type))) return true;
      return Array.isArray(node.content) && hasContent(node.content);
    });
  return !hasContent(doc.content);
}
