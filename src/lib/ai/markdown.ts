import {
  type ArticleDoc,
  type BlockNode,
  type InlineNode,
  type Mark,
  sanitizeDoc,
  type SanitizeResult,
} from "@/lib/content/document";

/**
 * Tiptap JSON ⇄ restricted Markdown, the format we exchange with the model.
 *
 *   ## / ### headings, paragraphs, **bold**, _italic_, ~~strike~~, ++underline++,
 *   - bullets, 1. numbers (nested by indentation), > quotes, [text](url),
 *   and a trailing "\" for a line break.
 *
 * Images, YouTube and X embeds and dividers are never sent to the model: they
 * become [[KT_BLOCK_n]] placeholder lines and are restored from the original
 * document afterwards, in place. Markdown → JSON always ends in sanitizeDoc,
 * the editor's allow-list, so model output gets exactly the same treatment
 * as pasted user content. Pure module (client and server).
 */

export const placeholder = (n: number) => `[[KT_BLOCK_${n}]]`;
const PLACEHOLDER_LINE = /^\s*\[\[KT_BLOCK_(\d+)\]\]\s*$/;
const PLACEHOLDER_ANY = /(?<!\\)\[\[KT_BLOCK_(\d+)\]\]/g;

type PlaceholderNode = { type: "__placeholder"; id: string };
type RawBlock = BlockNode | PlaceholderNode;

// ─── Tiptap → Markdown ──────────────────────────────────────────────────────

export type MarkdownExport = {
  markdown: string;
  /** Placeholder id → original block (image, youtube, tweet, horizontalRule). */
  blocks: Map<string, BlockNode>;
};

const MARK_ORDER = ["link", "bold", "italic", "strike", "underline"] as const;
const DELIMITER = { bold: "**", italic: "_", strike: "~~", underline: "++" } as const;

const markKey = (mark: Mark) => (mark.type === "link" ? `link:${mark.attrs.href}` : mark.type);
const openMark = (mark: Mark) => (mark.type === "link" ? "[" : DELIMITER[mark.type]);
/** Link target for "](…)". Balanced parentheses are fine as-is (the parser nests); unbalanced ones are encoded. */
function linkTarget(href: string) {
  const balanced = (href.match(/\(/g)?.length ?? 0) === (href.match(/\)/g)?.length ?? 0);
  return (balanced ? href : href.replace(/\(/g, "%28").replace(/\)/g, "%29")).replace(/ /g, "%20");
}
const closeMark = (mark: Mark) => (mark.type === "link" ? `](${linkTarget(mark.attrs.href)})` : DELIMITER[mark.type]);

function escapeText(text: string) {
  return text
    .replace(/[\\*_[\]`<]/g, "\\$&")
    .replace(/~(?=~)/g, "\\~")
    .replace(/\+(?=\+)/g, "\\+");
}

/** Escapes characters that would start a block at the beginning of a line. */
function escapeLineStart(line: string) {
  return line.replace(/^(\s*)([#>+-])/, "$1\\$2").replace(/^(\s*)(\d+)([.)])/, "$1$2\\$3");
}

function inlineToMarkdown(nodes: InlineNode[] | undefined): string {
  let out = "";
  let active: Mark[] = [];
  let pendingSpace = "";

  const transition = (desired: Mark[]) => {
    let common = 0;
    while (common < active.length && common < desired.length && markKey(active[common]) === markKey(desired[common])) common++;
    for (let i = active.length - 1; i >= common; i--) out += closeMark(active[i]);
    out += pendingSpace;
    pendingSpace = "";
    return () => {
      for (let i = common; i < desired.length; i++) out += openMark(desired[i]);
      active = desired;
    };
  };

  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      out += pendingSpace;
      pendingSpace = "";
      out += "\\\n";
      continue;
    }
    const desired = [...(node.marks ?? [])].sort(
      (a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type),
    );
    const [, lead, core, trail] = node.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (!core) {
      pendingSpace += node.text;
      continue;
    }
    const open = transition(desired);
    out += lead;
    open();
    out += escapeText(core);
    pendingSpace = trail;
  }
  transition([])();
  return out + pendingSpace;
}

const indent = (text: string, width: number) =>
  text
    .split("\n")
    .map((line) => (line ? " ".repeat(width) + line : line))
    .join("\n");

export function docToMarkdown(doc: ArticleDoc | null | undefined, options: { placeholders?: boolean } = {}): MarkdownExport {
  const blocks = new Map<string, BlockNode>();
  const usePlaceholders = options.placeholders ?? true;

  function block(node: BlockNode): string {
    switch (node.type) {
      case "paragraph":
        return inlineToMarkdown(node.content).split("\n").map(escapeLineStart).join("\n");
      case "heading":
        return `${"#".repeat(node.attrs.level)} ${inlineToMarkdown(node.content).replace(/\\\n/g, " ")}`;
      case "bulletList":
        return node.content.map((item) => listItem(item.content, "- ")).join("\n");
      case "orderedList":
        return node.content.map((item, i) => listItem(item.content, `${node.attrs.start + i}. `)).join("\n");
      case "blockquote":
        return blocksToMarkdown(node.content)
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n");
      case "image":
      case "youtube":
      case "tweet":
      case "horizontalRule": {
        if (!usePlaceholders) return "";
        const id = String(blocks.size + 1);
        blocks.set(id, node);
        return placeholder(Number(id));
      }
    }
  }

  function listItem(content: BlockNode[], marker: string): string {
    const [first, ...rest] = content;
    let out = marker + indent(first ? block(first) : "", marker.length).trimStart();
    for (const child of rest) {
      const text = block(child);
      if (!text) continue;
      const nestedList = child.type === "bulletList" || child.type === "orderedList";
      out += (nestedList ? "\n" : "\n\n") + indent(text, marker.length);
    }
    return out;
  }

  function blocksToMarkdown(nodes: BlockNode[]): string {
    return nodes
      .map(block)
      .filter((text) => text.trim() !== "")
      .join("\n\n");
  }

  return { markdown: doc ? blocksToMarkdown(doc.content) : "", blocks };
}

// ─── Markdown → Tiptap ──────────────────────────────────────────────────────

/** Removes raw HTML from model output. Text between ordinary tags is kept. */
export function stripHtml(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>/gi, "")
    .replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, "[$1]($1)")
    .replace(/(?<!\\)<\/?[a-zA-Z][^<>]*>/g, "");
}

const PUNCTUATION = /[!-/:-@[-`{-~]/;

type InlineMarkSpec = { delimiter: string; mark: Mark["type"] };
const PAIRED: InlineMarkSpec[] = [
  { delimiter: "**", mark: "bold" },
  { delimiter: "__", mark: "bold" },
  { delimiter: "~~", mark: "strike" },
  { delimiter: "++", mark: "underline" },
  { delimiter: "*", mark: "italic" },
  { delimiter: "_", mark: "italic" },
];

/** Index of the closing delimiter, skipping escapes (and "**" when looking for "*"). */
function findClose(text: string, from: number, delimiter: string): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] === "\\") {
      j++;
      continue;
    }
    if (delimiter.length === 1 && text[j] === delimiter && text[j + 1] === delimiter) {
      j++;
      continue;
    }
    if (text.startsWith(delimiter, j)) return j;
  }
  return -1;
}

/** Matching "]" for a "[" at `start`, honouring nesting and escapes. */
function findBracket(text: string, start: number): number {
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === "[") depth++;
    else if (text[j] === "]" && --depth === 0) return j;
  }
  return -1;
}

/** Matching ")" for a "(" at `start`, honouring nested parentheses. */
function findParen(text: string, start: number): number {
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === "(") depth++;
    else if (text[j] === ")" && --depth === 0) return j;
  }
  return -1;
}

function parseInline(text: string, marks: Mark[] = []): InlineNode[] {
  const out: InlineNode[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer, ...(marks.length ? { marks } : {}) });
    buffer = "";
  };
  const withMark = (mark: Mark) => (marks.some((m) => m.type === mark.type) ? marks : [...marks, mark]);

  let i = 0;
  outer: while (i < text.length) {
    const char = text[i];

    if (char === "\\" && text[i + 1] === "\n") {
      flush();
      out.push({ type: "hardBreak" });
      i += 2;
      continue;
    }
    if (char === "\\" && i + 1 < text.length && PUNCTUATION.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (char === "\n") {
      if (/ {2,}$/.test(buffer)) {
        buffer = buffer.replace(/ +$/, "");
        flush();
        out.push({ type: "hardBreak" });
      } else {
        buffer = buffer.replace(/ +$/, "") + " ";
      }
      i++;
      while (text[i] === " ") i++;
      continue;
    }

    // ***bold italic***
    if (text.startsWith("***", i)) {
      const close = text.indexOf("***", i + 3);
      if (close > i + 3) {
        flush();
        out.push(...parseInline(text.slice(i + 3, close), withMark({ type: "italic" }).concat(marks.some((m) => m.type === "bold") ? [] : [{ type: "bold" }])));
        i = close + 3;
        continue;
      }
    }

    for (const { delimiter, mark } of PAIRED) {
      if (!text.startsWith(delimiter, i)) continue;
      const close = findClose(text, i + delimiter.length, delimiter);
      if (close > i + delimiter.length) {
        flush();
        out.push(...parseInline(text.slice(i + delimiter.length, close), withMark({ type: mark } as Mark)));
        i = close + delimiter.length;
        continue outer;
      }
      break; // unmatched: the delimiter is literal text
    }

    // ![alt](url) — images are never accepted from Markdown: drop entirely.
    if (char === "!" && text[i + 1] === "[") {
      const end = findBracket(text, i + 1);
      if (end > 0 && text[end + 1] === "(") {
        const paren = findParen(text, end + 1);
        if (paren > 0) {
          i = paren + 1;
          continue;
        }
      }
    }

    if (char === "[") {
      const end = findBracket(text, i);
      if (end > 0 && text[end + 1] === "(") {
        const paren = findParen(text, end + 1);
        if (paren > 0) {
          const target = text.slice(end + 2, paren).trim().replace(/\s+"[^"]*"$/, "").replace(/^<|>$/g, "");
          flush();
          out.push(...parseInline(text.slice(i + 1, end), withMark({ type: "link", attrs: { href: target } })));
          i = paren + 1;
          continue;
        }
      }
    }

    buffer += char;
    i++;
  }
  flush();
  return out;
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE = /^\s{0,3}>/;
// Numbered items also accept Urdu/Arabic-Indic digits and the Urdu full stop ("۱۔"), as Urdu text often uses them.
const LIST_ITEM = /^(\s*)([-*+]|[0-9۰-۹٠-٩]{1,9}[.)۔])\s+(.*)$/;
const ORDERED_MARKER = /[0-9۰-۹٠-٩]/;
const toAsciiDigits = (value: string) =>
  value.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const indentOf = (line: string) => line.match(/^\s*/)![0].replace(/\t/g, "    ").length;
const isBlank = (line: string) => line.trim() === "";
const startsBlock = (line: string) =>
  HEADING.test(line) || QUOTE.test(line) || FENCE.test(line) || PLACEHOLDER_LINE.test(line) || RULE.test(line);

function parseBlocks(lines: string[]): RawBlock[] {
  const out: RawBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const ph = line.match(PLACEHOLDER_LINE);
    if (ph) {
      out.push({ type: "__placeholder", id: ph[1] });
      i++;
      continue;
    }

    // Thematic breaks are not part of the AI format (dividers only come back via placeholders).
    if (RULE.test(line) || TABLE_SEPARATOR.test(line)) {
      i++;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      out.push({ type: "heading", attrs: { level: heading[1].length <= 2 ? 2 : 3 }, content: parseInline(heading[2]) });
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const fence = line.trim().slice(0, 3);
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      // Code is not an allowed block: keep its text as plain paragraphs.
      for (const text of body.join("\n").split(/\n\s*\n/)) {
        if (text.trim()) out.push({ type: "paragraph", content: [{ type: "text", text: text.trim() }] });
      }
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) inner.push(lines[i++].replace(/^\s{0,3}> ?/, ""));
      out.push({ type: "blockquote", content: parseBlocks(inner) as BlockNode[] });
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      const [list, next] = parseList(lines, i);
      out.push(list);
      i = next;
      continue;
    }

    // Paragraph: up to a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || (!startsBlock(lines[i]) && !LIST_ITEM.test(lines[i])))) {
      const text = lines[i++].replace(/^\s+/, "");
      if (TABLE_SEPARATOR.test(text)) continue;
      // Tables are not allowed: keep each row's cells as plain text.
      para.push(text.startsWith("|") ? text.replace(/^\|\s*|\s*\|\s*$/g, "").replace(/\s*\|\s*/g, " · ") : text);
    }
    out.push({ type: "paragraph", content: parseInline(para.join("\n")) });
  }
  return out;
}

function parseList(lines: string[], start: number): [RawBlock, number] {
  const first = lines[start].match(LIST_ITEM)!;
  const baseIndent = indentOf(first[1]);
  const ordered = ORDERED_MARKER.test(first[2]);
  const items: { type: "listItem"; content: BlockNode[] }[] = [];
  let i = start;

  while (i < lines.length) {
    const match = lines[i].match(LIST_ITEM);
    if (!match || indentOf(match[1]) !== baseIndent || ORDERED_MARKER.test(match[2]) !== ordered) break;
    const contentIndent = baseIndent + match[2].length + 1;
    const content = [match[3]];
    i++;

    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) {
        let next = i + 1;
        while (next < lines.length && isBlank(lines[next])) next++;
        if (next < lines.length && indentOf(lines[next]) > baseIndent) {
          content.push(...lines.slice(i, next));
          i = next;
          continue;
        }
        break;
      }
      if (indentOf(line) > baseIndent) {
        content.push(line.slice(Math.min(indentOf(line), contentIndent)));
        i++;
        continue;
      }
      if (LIST_ITEM.test(line) || startsBlock(line) || isBlank(content[content.length - 1])) break;
      content.push(line); // lazy continuation of the item's paragraph
      i++;
    }

    items.push({ type: "listItem", content: parseBlocks(content) as BlockNode[] });

    // A blank line followed by another item of the same list continues it.
    let next = i;
    while (next < lines.length && isBlank(lines[next])) next++;
    const sibling = lines[next]?.match(LIST_ITEM);
    if (sibling && indentOf(sibling[1]) === baseIndent && ORDERED_MARKER.test(sibling[2]) === ordered) i = next;
  }

  const list: RawBlock = ordered
    ? { type: "orderedList", attrs: { start: Number.parseInt(toAsciiDigits(first[2]), 10) || 1 }, content: items }
    : { type: "bulletList", content: items };
  return [list, i];
}

export type MarkdownImport = SanitizeResult & {
  /** Placeholder ids that were missing from the Markdown (their blocks were appended at the end). */
  missingPlaceholders: string[];
};

/**
 * Markdown → sanitized Tiptap document.
 *
 * - source "ai": raw HTML is stripped first (model output is untrusted).
 * - blocks: placeholder map from docToMarkdown. Each placeholder is replaced
 *   by its original block once; unknown or repeated placeholders are dropped,
 *   and blocks whose placeholder went missing are appended at the end so no
 *   image or embed is ever lost.
 * - imagePrefix: forwarded to sanitizeDoc so restored images stay valid.
 */
export function markdownToDoc(
  markdown: string,
  options: { source: "ai" | "trusted"; blocks?: Map<string, BlockNode>; imagePrefix: string | null; appendMissing?: boolean },
): MarkdownImport {
  let text = markdown.replace(/\r\n?/g, "\n");
  if (options.source === "ai") text = stripHtml(text);
  // A placeholder the model merged into a sentence goes back on its own line.
  text = text.replace(PLACEHOLDER_ANY, (match) => `\n\n${match}\n\n`);

  const used = new Set<string>();
  const restore = (nodes: RawBlock[]): BlockNode[] =>
    nodes.flatMap((node): BlockNode[] => {
      if (node.type === "__placeholder") {
        const original = options.blocks?.get(node.id);
        if (!original || used.has(node.id)) return [];
        used.add(node.id);
        return [original];
      }
      if (node.type === "blockquote") return [{ ...node, content: restore(node.content) }];
      if (node.type === "bulletList" || node.type === "orderedList") {
        return [{ ...node, content: node.content.map((item) => ({ ...item, content: restore(item.content) })) } as BlockNode];
      }
      return [node];
    });

  const content = restore(parseBlocks(text.split("\n")));
  const missingPlaceholders = [...(options.blocks?.keys() ?? [])].filter((id) => !used.has(id));
  if (options.appendMissing !== false) {
    for (const id of missingPlaceholders) content.push(options.blocks!.get(id)!);
  }

  const result = sanitizeDoc({ type: "doc", content }, { imagePrefix: options.imagePrefix });
  return { ...result, missingPlaceholders };
}

/** Placeholder ids present in a Markdown string, in order. */
export function placeholdersIn(markdown: string): string[] {
  return [...markdown.matchAll(PLACEHOLDER_ANY)].map((match) => match[1]);
}

/**
 * Splits Markdown into chunks of at most ~maxChars at top-level block
 * boundaries (never inside a list or quote), preferring to start a new chunk
 * at a ## heading. Used to translate long articles in parts.
 */
export function splitMarkdown(markdown: string, maxChars = 6000): string[] {
  const blocks: string[] = [];
  for (const piece of markdown.split(/\n{2,}(?=\S)/)) {
    if (piece.trim()) blocks.push(piece);
  }
  const chunks: string[] = [];
  let current = "";
  for (const piece of blocks) {
    const startsSection = /^#{2}\s/.test(piece);
    const wouldBe = current ? `${current}\n\n${piece}` : piece;
    if (current && (wouldBe.length > maxChars || (startsSection && current.length > maxChars / 2))) {
      chunks.push(current);
      current = piece;
    } else {
      current = wouldBe;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
