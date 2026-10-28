import assert from "node:assert/strict";

import { adsTxtLine, extractPublisherId, parseAdUnit } from "../src/lib/ads";

/** Phase 7 pure rules: AdSense ID extraction. `npm run verify:growth` */

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

console.log(`\n${passed} passed`);
