import assert from "node:assert/strict";

import { countWords, docToPlainText, readingMinutes, sanitizeDoc } from "../src/lib/content/document";
import { renderDocToHtml } from "../src/lib/content/render";
import { normalizeXStatusUrl, parseYouTubeId, safeImageSrc, safeLinkHref, storagePublicPrefix } from "../src/lib/content/urls";
import { missingForPublish } from "../src/lib/articles/rules";
import { isValidSlug, slugify } from "../src/lib/articles/slug";
import { detectImageMime } from "../src/lib/uploads/file-type";

const prefix = storagePublicPrefix("https://abc.supabase.co")!;
const goodImg = `${prefix}articles/2026/10/123e4567-e89b-42d3-a456-426614174000.webp`;
let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

t("links", () => {
  assert.equal(safeLinkHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(safeLinkHref("mailto:editor@kabirtalks.com"), "mailto:editor@kabirtalks.com");
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<b>", "vbscript:x", "//evil.com", "/relative", "ftp://x.com", "https://", "mailto:", "file:///etc/passwd"])
    assert.equal(safeLinkHref(bad), null, bad);
});

t("youtube", () => {
  for (const ok of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=42", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"])
    assert.equal(parseYouTubeId(ok), "dQw4w9WgXcQ", ok);
  for (const bad of ["https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "javascript:alert('youtube.com')", "https://www.youtube.com/watch?v=short", "https://vimeo.com/123"])
    assert.equal(parseYouTubeId(bad), null, bad);
});

t("x/twitter", () => {
  assert.equal(normalizeXStatusUrl("https://twitter.com/jack/status/20?s=20"), "https://x.com/jack/status/20");
  assert.equal(normalizeXStatusUrl("https://x.com/user_1/status/1234567890"), "https://x.com/user_1/status/1234567890");
  for (const bad of ["https://x.com/user", "https://x.com.evil.com/a/status/1", "https://evil.com/a/status/1", "javascript:x.com/a/status/1"])
    assert.equal(normalizeXStatusUrl(bad), null, bad);
});

t("images", () => {
  assert.equal(safeImageSrc(goodImg, prefix), goodImg);
  for (const bad of ["https://evil.com/a.png", `${prefix}../secret.png`, `${prefix}articles/2026/10/x.png`, "data:image/png;base64,AAAA", goodImg.replace("abc", "evil")])
    assert.equal(safeImageSrc(bad, prefix), null, bad);
  assert.equal(safeImageSrc(goodImg, null), null);
});

const hostile = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title <script>alert(1)</script>" }] },
    { type: "paragraph", content: [
      { type: "text", text: "safe link", marks: [{ type: "link", attrs: { href: "https://example.com" } }, { type: "bold" }] },
      { type: "text", text: " evil link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      { type: "text", text: " code", marks: [{ type: "code" }] },
      { type: "mention", attrs: { id: "x" } },
    ] },
    { type: "codeBlock", content: [{ type: "text", text: "rm -rf" }] },
    { type: "image", attrs: { src: "https://evil.com/x.png", alt: "x" } },
    { type: "image", attrs: { src: goodImg, alt: "" } },
    { type: "image", attrs: { src: goodImg, alt: "A \"quoted\" alt", onerror: "alert(1)" } },
    { type: "youtube", attrs: { src: "https://youtu.be/dQw4w9WgXcQ" } },
    { type: "youtube", attrs: { src: "https://evil.com/embed/dQw4w9WgXcQ" } },
    { type: "tweet", attrs: { url: "https://twitter.com/jack/status/20" } },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }, { type: "paragraph" }] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quote" }] }] },
    { type: "rawHtml", html: "<img src=x onerror=alert(1)>" },
  ],
};

t("sanitize hostile doc", () => {
  const { doc, removed } = sanitizeDoc(hostile, { imagePrefix: prefix });
  assert.ok(doc);
  const types = doc.content.map((n) => n.type);
  assert.deepEqual(types, ["heading", "paragraph", "image", "youtube", "tweet", "bulletList", "blockquote"]);
  assert.equal((doc.content[0] as { attrs: { level: number } }).attrs.level, 2);
  const json = JSON.stringify(doc);
  for (const banned of ["javascript", "codeBlock", "mention", "rawHtml", "onerror", "evil.com", '"code"'])
    assert.ok(!json.includes(banned), banned);
  assert.ok(removed.length >= 6, JSON.stringify(removed));
  console.log("   removed:", removed.join("; "));
});

t("render escapes and uses nocookie", () => {
  const html = renderDocToHtml(hostile, { imagePrefix: prefix });
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!/<script/i.test(html));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("onerror"));
  assert.ok(html.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
  assert.ok(html.includes('alt="A &quot;quoted&quot; alt"'));
  assert.ok(html.includes('<a href="https://example.com/" target="_blank" rel="noopener noreferrer nofollow ugc"><strong>safe link</strong></a>'));
  assert.ok(html.includes('href="https://x.com/jack/status/20"'));
  assert.ok(html.includes("<h2>"));
});

t("garbage input", () => {
  for (const g of [null, undefined, "doc", 42, [], { type: "paragraph" }, { type: "doc", content: "x" }])
    assert.equal(renderDocToHtml(g, { imagePrefix: prefix }), "");
  const deep: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "deep" }] };
  let node = deep;
  for (let i = 0; i < 50; i++) node = { type: "blockquote", content: [node] };
  const r = sanitizeDoc({ type: "doc", content: [node] }, { imagePrefix: prefix });
  assert.ok(r.removed.includes("content nested too deeply"));
});

t("words + reading time", () => {
  const doc = sanitizeDoc({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "یہ ایک اردو جملہ ہے" }] }, { type: "paragraph", content: [{ type: "text", text: "And five English words here" }] }] }, { imagePrefix: prefix }).doc;
  const text = docToPlainText(doc);
  assert.equal(countWords(text), 10);
  assert.equal(readingMinutes(10, "en"), 1);
  assert.equal(readingMinutes(0, "ur"), 0);
  assert.equal(readingMinutes(1000, "en"), 5);
});

// ---- uploads, slugs, publish checklist (Phase 2)
const bytes = (...values: (number | string)[]) => {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === "string") out.push(...[...v].map((c) => c.charCodeAt(0)));
    else out.push(v);
  }
  while (out.length < 32) out.push(0);
  return new Uint8Array(out);
};

t("image magic bytes", () => {
  assert.equal(detectImageMime(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(detectImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(detectImageMime(bytes("RIFF", 0, 0, 0, 0, "WEBP")), "image/webp");
  assert.equal(detectImageMime(bytes(0, 0, 0, 0x1c, "ftyp", "avif", 0, 0, 0, 0, "mif1")), "image/avif");
  assert.equal(detectImageMime(bytes(0, 0, 0, 0x1c, "ftyp", "mif1", 0, 0, 0, 0, "avif")), "image/avif");
  assert.equal(detectImageMime(bytes(0, 0, 0, 0x1c, "ftyp", "heic", 0, 0, 0, 0, "mif1")), null);
  assert.equal(detectImageMime(bytes("<html><script>")), null);
  assert.equal(detectImageMime(bytes("GIF89a")), null);
  assert.equal(detectImageMime(bytes("MZ")), null);
  assert.equal(detectImageMime(new Uint8Array([0xff, 0xd8])), null);
});

t("slugs", () => {
  assert.equal(slugify("Budget 2026: What It Means!"), "budget-2026-what-it-means");
  assert.equal(slugify("  Café — naïve’s guide  "), "cafe-naives-guide");
  assert.equal(slugify("بجٹ ۲۰۲۶"), "");
  assert.ok(isValidSlug("budget-2026"));
  for (const bad of ["Budget", "budget--2026", "-budget", "budget-", "bud get", "بجٹ", ""]) assert.ok(!isValidSlug(bad), bad);
});

t("publish checklist", () => {
  const body = { type: "doc" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Body" }] }] };
  const none = { title: null, body: null };
  const keys = (items: { key: string }[]) => items.map((m) => m.key);
  assert.deepEqual(keys(missingForPublish({ categoryId: "c", slug: "s", en: none, ur: none })), ["language"]);
  assert.deepEqual(keys(missingForPublish({ categoryId: "c", slug: "s", en: { title: "T", body: null }, ur: none })), ["language"]);
  assert.deepEqual(missingForPublish({ categoryId: "c", slug: "s", en: none, ur: { title: "عنوان", body } }), []);
  assert.deepEqual(keys(missingForPublish({ categoryId: null, slug: "", en: { title: "T", body }, ur: none })), ["category", "slug"]);
  assert.deepEqual(
    keys(missingForPublish({ categoryId: "c", slug: "s", en: { title: "T", body }, ur: none, coverImageUrl: "x", coverImageAlt: " " })),
    ["coverAlt"],
  );
});

console.log(`\n${passed} test groups passed`);
