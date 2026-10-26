import assert from "node:assert/strict";

import { z } from "zod";

import { AiError } from "../src/lib/ai/errors";
import { parseJsonOutput } from "../src/lib/ai/json";
import { docToMarkdown, markdownToDoc, placeholdersIn, splitMarkdown, stripHtml } from "../src/lib/ai/markdown";
import { createMockProvider, mockTranslate } from "../src/lib/ai/mock";
import { aiDay, secondsUntilReset } from "../src/lib/ai/day";
import { isExpectedScript } from "../src/lib/ai/script";
import { type ArticleDoc, type BlockNode, sanitizeDoc } from "../src/lib/content/document";
import { renderDocToHtml } from "../src/lib/content/render";
import { storagePublicPrefix } from "../src/lib/content/urls";

/**
 * Self-checks for the Phase 3 AI pipeline (no server, no network):
 *   npm run verify:ai
 */

const prefix = storagePublicPrefix("https://abc.supabase.co")!;
const IMG = `${prefix}articles/2026/10/123e4567-e89b-42d3-a456-426614174000.webp`;
let passed = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log("ok -", name);
}

const text = (value: string, marks?: { type: string; attrs?: { href: string } }[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => sanitizeDoc({ type: "doc", content }, { imagePrefix: prefix }).doc!;

function roundTrip(input: ArticleDoc) {
  const { markdown, blocks } = docToMarkdown(input);
  const back = markdownToDoc(markdown, { source: "trusted", blocks, imagePrefix: prefix });
  return { markdown, back: back.doc, missing: back.missingPlaceholders, removed: back.removed };
}

const rich = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("Budget 2026 – what changes")] },
  p(
    text("Plain, "),
    text("bold", [{ type: "bold" }]),
    text(" and "),
    text("bold italic", [{ type: "bold" }, { type: "italic" }]),
    text(" then "),
    text("italic", [{ type: "italic" }]),
    text(", "),
    text("struck", [{ type: "strike" }]),
    text(", "),
    text("under", [{ type: "underline" }]),
    text(" and a "),
    text("bold link", [{ type: "link", attrs: { href: "https://example.com/a_(b)" } }, { type: "bold" }]),
    text("."),
  ),
  p(text("Specials: 5 * 3 = 15, snake_case, [brackets], C++ and ~~tilde~~, <b>not html</b>, \\backslash, `tick`.")),
  p(text("# not a heading")),
  p(text("- not a list")),
  p(text("1. not numbered")),
  p(text("> not a quote")),
  p(text("Line one"), { type: "hardBreak" }, text("line two")),
  { type: "image", attrs: { src: IMG, alt: "Crowd", title: "Caption" } },
  { type: "heading", attrs: { level: 3 }, content: [text("Lists")] },
  {
    type: "bulletList",
    content: [
      { type: "listItem", content: [p(text("First")), { type: "bulletList", content: [{ type: "listItem", content: [p(text("Nested"))] }] }] },
      { type: "listItem", content: [p(text("Second, with "), text("mail", [{ type: "link", attrs: { href: "mailto:desk@kabirtalks.com" } }]))] },
      { type: "listItem", content: [p(text("Two paragraphs")), p(text("second paragraph"))] },
    ],
  },
  { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("Three"))] }, { type: "listItem", content: [p(text("Four"))] }] },
  { type: "youtube", attrs: { src: "https://youtu.be/dQw4w9WgXcQ" } },
  { type: "blockquote", content: [p(text("Quoted ")), p(text("second quote paragraph"))] },
  { type: "horizontalRule" },
  { type: "tweet", attrs: { url: "https://x.com/jack/status/20" } },
);

const urdu = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("بجٹ ۲۰۲۶ کی اہم باتیں")] },
  p(text("حکومت نے "), text("نیا بجٹ", [{ type: "bold" }]), text(" پیش کیا، "), text("مزید", [{ type: "link", attrs: { href: "https://example.com/ur" } }]), text("۔")),
  { type: "bulletList", content: [{ type: "listItem", content: [p(text("پہلا نکتہ"))] }, { type: "listItem", content: [p(text("دوسرا نکتہ"))] }] },
  { type: "blockquote", content: [p(text("ہم جائزہ لے رہے ہیں۔"))] },
);

const mixed = doc(p(text("پاکستان نے "), text("ICC Champions Trophy", [{ type: "italic" }]), text(" میں England کو 5 وکٹوں سے ہرایا۔")), {
  type: "orderedList",
  attrs: { start: 1 },
  content: [{ type: "listItem", content: [p(text("Babar Azam: "), text("۸۵ رنز", [{ type: "bold" }]))] }],
});

async function main() {
  await t("round trip: every allowed node and mark, specials, hard breaks, nesting", () => {
    const { markdown, back, missing } = roundTrip(rich);
    assert.deepEqual(missing, []);
    assert.deepEqual(back, rich, `markdown was:\n${markdown}`);
    assert.ok(!markdown.includes(IMG) && !markdown.includes("youtu") && !markdown.includes("x.com/jack"), "embeds must not reach the model");
    assert.deepEqual(placeholdersIn(markdown), ["1", "2", "3", "4"]);
  });

  await t("round trip: Urdu", () => assert.deepEqual(roundTrip(urdu).back, urdu));
  await t("round trip: mixed English/Urdu", () => assert.deepEqual(roundTrip(mixed).back, mixed));
  await t("round trip: empty and null", () => {
    assert.equal(docToMarkdown(null).markdown, "");
    assert.equal(markdownToDoc("", { source: "ai", imagePrefix: prefix }).doc, null);
  });

  await t("placeholders: mock translation keeps embeds in position (EN→UR→EN)", () => {
    const { markdown, blocks } = docToMarkdown(rich);
    const ur = mockTranslate(markdown, "ur");
    assert.ok(isExpectedScript(ur, "ur"), ur);
    const urDoc = markdownToDoc(ur, { source: "ai", blocks, imagePrefix: prefix });
    assert.deepEqual(urDoc.missingPlaceholders, []);
    const types = urDoc.doc!.content.map((node) => node.type);
    assert.deepEqual(types, rich.content.map((node) => node.type), "block order changed");
    const image = urDoc.doc!.content.find((node) => node.type === "image");
    assert.deepEqual(image, rich.content.find((node) => node.type === "image"));
    const html = renderDocToHtml(urDoc.doc, { imagePrefix: prefix });
    assert.ok(html.includes("youtube-nocookie.com/embed/dQw4w9WgXcQ") && html.includes('href="https://example.com/a_(b)"'), html);
    const en = markdownToDoc(mockTranslate(ur, "en"), { source: "ai", blocks, imagePrefix: prefix });
    assert.deepEqual(en.doc!.content.map((node) => node.type), types);
  });

  await t("placeholders: missing ones are appended, unknown/duplicate ones dropped", () => {
    const { markdown, blocks } = docToMarkdown(rich);
    const lost = markdown.replace("[[KT_BLOCK_2]]", "").replace("[[KT_BLOCK_4]]", "[[KT_BLOCK_9]] [[KT_BLOCK_1]]");
    const result = markdownToDoc(lost, { source: "ai", blocks, imagePrefix: prefix });
    assert.deepEqual(result.missingPlaceholders, ["2", "4"]);
    const embedTypes = result.doc!.content.filter((n) => ["image", "youtube", "horizontalRule", "tweet"].includes(n.type)).map((n) => n.type);
    assert.deepEqual(embedTypes, ["image", "horizontalRule", "youtube", "tweet"]);
  });

  await t("placeholders: a placeholder merged into a sentence still restores as a block", () => {
    const blocks = new Map<string, BlockNode>([["1", { type: "tweet", attrs: { url: "https://x.com/jack/status/20" } }]]);
    const result = markdownToDoc("Before [[KT_BLOCK_1]] after.", { source: "ai", blocks, imagePrefix: prefix });
    assert.deepEqual(result.doc!.content.map((n) => n.type), ["paragraph", "tweet", "paragraph"]);
  });

  await t("AI output: malicious links, raw HTML, script tags, images and embeds are stripped", () => {
    const evil = [
      "# Title becomes H2",
      "#### Deep heading becomes H3",
      "Safe [link](https://example.com) and [js](javascript:alert(1)) and [data](data:text/html,<b>x</b>) and [vb](vbscript:x).",
      "<script>alert('xss')</script>",
      "<a href=\"javascript:alert(2)\">html link text</a> <img src=x onerror=alert(3)> <b>bold tag</b>",
      '<iframe src="https://evil.com/embed"></iframe>',
      "![tracker](https://evil.com/pixel.png)",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "[[KT_BLOCK_1]]",
      "```html\n<i>code</i> stays as text\n```",
      "| a | b |\n|---|---|\n| 1 | 2 |",
      "---",
      "<style>body{display:none}</style><!-- comment --><svg onload=alert(4)><circle/></svg>",
    ].join("\n\n");
    const { doc: out } = markdownToDoc(evil, { source: "ai", imagePrefix: prefix });
    const json = JSON.stringify(out);
    for (const banned of ["javascript", "data:text", "vbscript", "<script", "alert('xss')", "onerror", "evil.com", "iframe", "<b>", "<svg", "display:none", "comment", "horizontalRule", '"image"', '"youtube"', '"tweet"']) {
      assert.ok(!json.includes(banned), `output contains ${banned}: ${json}`);
    }
    assert.ok(json.includes("https://example.com/") && json.includes("html link text") && json.includes("stays as text") && json.includes("a · b"), json);
    assert.deepEqual(out!.content.slice(0, 2).map((n) => (n.type === "heading" ? n.attrs.level : n.type)), [2, 3]);
    const html = renderDocToHtml(out, { imagePrefix: prefix });
    assert.ok(!/<(script|iframe|img|style|svg)/i.test(html) && !html.includes("javascript:"), html);
  });

  await t("stripHtml keeps text and autolinks, ignores escaped and non-tag <", () => {
    assert.equal(stripHtml("a <b>bold</b> < 5 and \\<i> <https://x.com/a>"), "a bold < 5 and \\<i> [https://x.com/a](https://x.com/a)");
  });

  await t("AI Markdown: lists (loose, nested, numbered start), quotes, hard breaks", () => {
    const md = "Intro line one\\\nline two\n\n1. One\n2. Two\n   - nested a\n   - nested b\n\n3. Three\n\n> quoted **bold**\n> more\n\n- x\n- y";
    const out = markdownToDoc(md, { source: "ai", imagePrefix: null }).doc!;
    assert.deepEqual(out.content.map((n) => n.type), ["paragraph", "orderedList", "blockquote", "bulletList"]);
    const ol = out.content[1];
    assert.ok(ol.type === "orderedList" && ol.content.length === 3 && ol.content[1].content[1]?.type === "bulletList", JSON.stringify(ol));
    assert.ok(JSON.stringify(out.content[0]).includes("hardBreak"));
  });

  await t("AI Markdown: Urdu numbered lists (۱۔ / ٢) and the Urdu full stop", () => {
    const out = markdownToDoc("۳۔ پہلا\n۴۔ دوسرا\n\n- نکتہ", { source: "ai", imagePrefix: null }).doc!;
    assert.deepEqual(out.content.map((n) => n.type), ["orderedList", "bulletList"]);
    assert.ok(out.content[0].type === "orderedList" && out.content[0].attrs.start === 3 && out.content[0].content.length === 2);
  });

  await t("split long Markdown into chunks at block boundaries", () => {
    const sections = Array.from({ length: 6 }, (_, i) => `## Section ${i}\n\n${"Word ".repeat(300)}\n\n- a\n- b\n  continued`).join("\n\n");
    const chunks = splitMarkdown(sections, 2500);
    assert.ok(chunks.length > 1);
    assert.equal(chunks.join("\n\n"), sections);
    for (const chunk of chunks) assert.ok(chunk.startsWith("## Section"), chunk.slice(0, 30));
  });

  await t("Urdu script check: Urdu ok (with English names), Hindi and Roman Urdu rejected", () => {
    assert.ok(isExpectedScript("پاکستان نے ICC ٹورنامنٹ میں England کو شکست دی اور شائقین نے جشن منایا۔", "ur"));
    assert.ok(!isExpectedScript("यह एक परीक्षण लेख है। सरकार ने आज नई नीति की घोषणा की।", "ur"));
    assert.ok(!isExpectedScript("Yeh aik test khabar hai. Hukoomat ne aaj naya faisla kiya.", "ur"));
    assert.ok(isExpectedScript("Pakistan beat England by five wickets in Lahore.", "en"));
    assert.ok(!isExpectedScript("پاکستان نے انگلینڈ کو پانچ وکٹوں سے شکست دے دی۔", "en"));
    assert.ok(isExpectedScript("[[KT_BLOCK_1]] ok", "ur"), "too short to judge");
  });

  await t("structured output validation", () => {
    const schema = z.object({ title: z.string().min(1) });
    assert.deepEqual(parseJsonOutput('```json\n{"title":"Hi"}\n```', schema), { title: "Hi" });
    for (const bad of ["{ not json", '{"title":""}', '{"other":1}', "[]"]) {
      assert.throws(() => parseJsonOutput(bad, schema), (e) => e instanceof AiError && e.code === "invalid_output");
    }
  });

  await t("mock provider: deterministic, streams, honours error markers and abort", async () => {
    const ai = createMockProvider();
    const request = { kind: "draft-body" as const, system: "", prompt: "", maxOutputTokens: 100, mockInput: { prompt: "rain", notes: "", locale: "ur", length: "short" } };
    const a = await ai.generate({ ...request, signal: new AbortController().signal });
    const b = await ai.generate({ ...request, signal: new AbortController().signal });
    assert.equal(a.text, b.text);
    assert.ok(isExpectedScript(a.text, "ur"));
    let streamed = "";
    for await (const delta of ai.stream({ ...request, signal: new AbortController().signal })) streamed += delta;
    assert.equal(streamed, a.text);
    await assert.rejects(
      ai.generate({ ...request, mockInput: { ...request.mockInput, prompt: "[[mock:error=quota]]" }, signal: new AbortController().signal }),
      (e) => e instanceof AiError && e.code === "quota",
    );
    const controller = new AbortController();
    const slow = ai.stream({ ...request, mockInput: { ...request.mockInput, prompt: "[[mock:slow]]" }, signal: controller.signal });
    setTimeout(() => controller.abort(new AiError("aborted")), 200);
    await assert.rejects(
      (async () => {
        for await (const delta of slow) void delta;
      })(),
      (e) => e instanceof AiError && e.code === "aborted",
    );
  });

  await t("AI day: Pakistan date (UTC+5) and seconds until its midnight", () => {
    const at = (iso: string) => Date.parse(iso);
    assert.equal(aiDay(at("2026-10-26T18:59:59Z")), "2026-10-26");
    assert.equal(aiDay(at("2026-10-26T19:00:00Z")), "2026-10-27", "midnight PKT is 19:00 UTC");
    assert.equal(secondsUntilReset(at("2026-10-26T18:59:00Z")), 60);
    assert.equal(secondsUntilReset(at("2026-10-26T19:00:00Z")), 86_400);
  });

  console.log(`\n${passed} test groups passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
