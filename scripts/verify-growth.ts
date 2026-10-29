import assert from "node:assert/strict";

import fs from "node:fs";

import { adsTxtLine, extractPublisherId, parseAdUnit } from "../src/lib/ads";
import { safeHttpsUrl } from "../src/lib/breaking";
import { socialLinksInputSchema, validateSocialUrl } from "../src/lib/social";
import { CHANNEL_ID_PATTERN, decodeXml, parseYouTubeFeed, videoEmbedUrl } from "../src/lib/youtube";

/** Phase 7 pure rules: AdSense ID extraction; Phase 7C social links, breaking links, YouTube feed. `npm run verify:growth` */

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };
const PUB = "ca-pub-1234567890123456";

t("publisher ID: accepted forms", () => {
  for (const input of [
    PUB,
    "pub-1234567890123456",
    `  ${PUB}\n`,
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB}" crossorigin="anonymous"></script>`,
    `<meta name="google-adsense-account" content="${PUB}">`,
    "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
  ]) {
    const result = extractPublisherId(input);
    assert.ok(result.ok, input);
    assert.equal(result.ok && result.value, PUB);
  }
});

t("publisher ID: everything else is rejected", () => {
  for (const input of [
    "",
    "   ",
    "hello",
    "ca-pub-123",
    "ca-pub-12345678901234567",
    "ca-pub-123456789012345a",
    "pub-",
    "ca-pub-1234567890123456 ca-pub-6543210987654321",
    "xpub-1234567890123456",
    "<script>alert(1)</script>",
    `javascript:alert('${PUB}x')`.replace(PUB, "ca-pub-12"),
    "x".repeat(5001),
  ]) {
    assert.ok(!extractPublisherId(input).ok, JSON.stringify(input.slice(0, 60)));
  }
});

t("ad unit: slot ID and full code", () => {
  assert.deepEqual(parseAdUnit("1234567890", PUB), { ok: true, value: { slotId: "1234567890", format: "auto", layout: null, layoutKey: null } });
  const responsive = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB}" crossorigin="anonymous"></script>
<ins class="adsbygoogle" style="display:block" data-ad-client="${PUB}" data-ad-slot="9876543210" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`;
  assert.deepEqual(parseAdUnit(responsive, PUB), { ok: true, value: { slotId: "9876543210", format: "auto", layout: null, layoutKey: null } });
  const inArticle = `<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="${PUB}" data-ad-slot="1111111111"></ins>`;
  assert.deepEqual(parseAdUnit(inArticle, PUB), { ok: true, value: { slotId: "1111111111", format: "fluid", layout: "in-article", layoutKey: null } });
  const inFeed = `<ins class="adsbygoogle" style="display:block" data-ad-format="fluid" data-ad-layout-key="-fb+5w+4e-db+86" data-ad-client="${PUB}" data-ad-slot="2222222222"></ins>`;
  assert.deepEqual(parseAdUnit(inFeed, PUB), { ok: true, value: { slotId: "2222222222", format: "fluid", layout: null, layoutKey: "-fb+5w+4e-db+86" } });
  // Without data-ad-client the unit is accepted against any saved publisher.
  assert.ok(parseAdUnit(`<ins data-ad-slot='3333333333'></ins>`, null).ok);
});

t("ad unit: everything else is rejected", () => {
  const other = "ca-pub-6543210987654321";
  for (const [input, publisher] of [
    ["", PUB],
    ["123", PUB],
    ["1234567890123", PUB],
    ["slot 1234567890", PUB],
    ["<ins class='adsbygoogle'></ins>", PUB],
    [`<ins data-ad-client="${other}" data-ad-slot="1234567890"></ins>`, PUB],
    [`<ins data-ad-client="${PUB}" data-ad-slot="1234567890"></ins>`, null],
    [`<ins data-ad-client="ca-pub-1" data-ad-slot="1234567890"></ins>`, PUB],
    [`<ins data-ad-slot="12345abc90"></ins>`, PUB],
    [`<ins data-ad-slot="1234567890"></ins><ins data-ad-slot="1234567891"></ins>`, PUB],
    [`<ins data-ad-slot="1234567890" data-ad-format="popup"></ins>`, PUB],
    [`<ins data-ad-slot="1234567890" data-ad-layout="overlay"></ins>`, PUB],
    [`<ins data-ad-slot="1234567890" data-ad-layout-key="<script>"></ins>`, PUB],
    [`<ins data-ad-slot="1234567890" onload="alert(1)" data-ad-format="auto" data-ad-layout-key="a b"></ins>`, PUB],
    ["x".repeat(5001), PUB],
  ] as const) {
    assert.ok(!parseAdUnit(input, publisher).ok, input.slice(0, 80));
  }
});

t("ads.txt line", () => {
  assert.equal(adsTxtLine(PUB), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0");
});

t("social links: each platform's own domains (and subdomains), https, a profile path", () => {
  const ok: [Parameters<typeof validateSocialUrl>[0], string][] = [
    ["youtube", "https://www.youtube.com/@kabirtalks"],
    ["youtube", "https://youtube.com/channel/UCabcdefghijklmnopqrstuv"],
    ["youtube", "https://youtu.be/dQw4w9WgXcQ"],
    ["whatsapp", "https://whatsapp.com/channel/0029VaKabir"],
    ["whatsapp", "https://www.whatsapp.com/channel/0029VaKabir/"],
    ["facebook", "https://www.facebook.com/kabirtalks"],
    ["facebook", "https://fb.com/kabirtalks"],
    ["facebook", "https://m.facebook.com/kabirtalks"],
    ["instagram", "https://instagram.com/kabirtalks"],
    ["x", "https://x.com/kabirtalks"],
    ["x", "https://twitter.com/kabirtalks"],
    ["tiktok", "https://www.tiktok.com/@kabirtalks"],
  ];
  for (const [platform, url] of ok) assert.ok(validateSocialUrl(platform, url).ok, `${platform} ${url}`);
});

t("social links: wrong domain, look-alikes, http, credentials, ports, bare homepages, non-channel WhatsApp", () => {
  const bad: [Parameters<typeof validateSocialUrl>[0], string][] = [
    ["youtube", "https://vimeo.com/kabir"],
    ["youtube", "https://youtube.com.evil.example/@k"],
    ["youtube", "https://notyoutube.com/@k"],
    ["youtube", "http://www.youtube.com/@k"],
    ["youtube", "https://www.youtube.com/"],
    ["whatsapp", "https://wa.me/923001234567"],
    ["whatsapp", "https://whatsapp.com/kabir"],
    ["whatsapp", "https://chat.whatsapp.com/AbCdEf"],
    ["facebook", "https://facebook.co/kabir"],
    ["facebook", "https://user:pw@facebook.com/kabir"],
    ["instagram", "https://instagram.com:8443/k"],
    ["instagram", "https://instagr.am/k"],
    ["x", "https://twitter.co/k"],
    ["x", "javascript:alert(1)"],
    ["tiktok", "tiktok.com/@k"],
    ["tiktok", "https://x.com/@k"],
  ];
  for (const [platform, url] of bad) assert.ok(!validateSocialUrl(platform, url).ok, `${platform} ${url}`);
  const parsed = socialLinksInputSchema.safeParse({ x: "https://x.com/k", youtube: "", facebook: "  " });
  assert.ok(parsed.success);
  assert.deepEqual(parsed.success && parsed.data, { x: "https://x.com/k" });
});

t("breaking-news links: https only", () => {
  assert.ok(safeHttpsUrl("https://example.com/live"));
  for (const url of ["http://example.com", "javascript:alert(1)", "https://u:p@example.com/", "https://localhost/", "ftp://example.com/x", 42]) assert.equal(safeHttpsUrl(url), null, String(url));
});

t("YouTube: channel ID format", () => {
  assert.ok(CHANNEL_ID_PATTERN.test("UCabcdefghijklmnopqrst_-"));
  for (const id of ["", "@kabirtalks", "UCshort", "UCabcdefghijklmnopqrstuvw", "XXabcdefghijklmnopqrstuv", "UCabcdefghijklmnopqrst<>"]) assert.ok(!CHANNEL_ID_PATTERN.test(id), id);
});

t("YouTube: parses the saved sample feed (6 newest, bad entry skipped, entities decoded, no feed thumbnails)", () => {
  const xml = fs.readFileSync(new URL("./fixtures/youtube-feed.xml", import.meta.url), "utf8");
  const videos = parseYouTubeFeed(xml);
  assert.equal(videos.length, 6);
  assert.deepEqual(videos.map((v) => v.id).slice(0, 3), ["dQw4w9WgXcQ", "aBcDeFgHiJk", "Zz_-0123456"]);
  assert.equal(videos[2].title, "Floods & the monsoon: live briefing");
  assert.equal(videos[3].title, "سیلاب کی تازہ صورتحال");
  assert.equal(videos[0].publishedAt, "2026-10-28T10:00:00.000Z");
  assert.ok(!JSON.stringify(videos).includes("evil.example"));
  assert.equal(parseYouTubeFeed(xml, 2).length, 2);
  assert.equal(videoEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
});

t("YouTube: garbage in, empty list out", () => {
  for (const input of [undefined, null, 42, "", "<html>not a feed</html>", "<feed></feed>", "<feed><entry><title>x</title></entry></feed>"]) {
    assert.deepEqual(parseYouTubeFeed(input), []);
  }
  assert.equal(decodeXml("a &amp; b &#x41; &#66; &lt;i&gt; &bogus;"), "a & b A B <i> &bogus;");
});

console.log(`\n${passed} passed`);
