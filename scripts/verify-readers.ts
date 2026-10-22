import assert from "node:assert/strict";

import { isReservedCategorySlug } from "../src/lib/articles/slug";
import { displayNameSchema, isPasswordValid, passwordChecks, safeReturnPath } from "../src/lib/auth-rules";
import { safeAvatarSrc, storagePublicPrefix } from "../src/lib/content/urls";

/** Phase 5 pure rules: return URLs, passwords, names, avatar URLs. `npm run verify:readers` */

const prefix = storagePublicPrefix("https://abc.supabase.co")!;
let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

t("return URL after sign-in: same-site paths only", () => {
  assert.equal(safeReturnPath("/ur/sports/some-article", "/en"), "/ur/sports/some-article");
  assert.equal(safeReturnPath("/en/search?q=budget#top", "/en"), "/en/search?q=budget#top");
  assert.equal(safeReturnPath("/admin", "/en"), "/admin");
  for (const bad of [
    null, "", "https://evil.com", "//evil.com", "///evil.com", "/\\evil.com", "\\\\evil.com", "/%5C\\evil.com",
    "javascript:alert(1)", " /en", "evil.com", "/en\u0000", "/en\nLocation: x", "/api/auth/sign-out",
    "/en/login", "/ur/signup?next=/en", "/en/reset-password", "/" + "a".repeat(1001),
  ]) assert.equal(safeReturnPath(bad, "/en"), "/en", String(bad));
  // Encoded slashes stay a path on this site.
  assert.equal(safeReturnPath("/%2F%2Fevil.com", "/en"), "/%2F%2Fevil.com");
});

t("password rules", () => {
  for (const ok of ["abcdefg1", "passw0rd!", "پاسورڈ12345", "a1" + "x".repeat(126)]) assert.ok(isPasswordValid(ok), ok);
  for (const bad of ["short1", "abcdefgh", "12345678", "a1" + "x".repeat(127), "", undefined, 12345678])
    assert.ok(!isPasswordValid(bad), String(bad));
  assert.deepEqual(passwordChecks("abc").map((c) => c.ok), [false, true, false]);
});

t("display names", () => {
  assert.equal(displayNameSchema.parse("  Sara   Reader "), "Sara Reader");
  assert.equal(displayNameSchema.parse("علی Khan"), "علی Khan");
  for (const bad of ["", "   ", "x".repeat(61), "<script>", "a‮b", "a\u0007b", 42])
    assert.ok(!displayNameSchema.safeParse(bad).success, String(bad));
});

t("avatar URLs: our bucket's avatars/ or Google only", () => {
  const ours = `${prefix}avatars/user_123/123e4567-e89b-42d3-a456-426614174000.png`;
  assert.equal(safeAvatarSrc(ours, prefix), ours);
  assert.equal(safeAvatarSrc("https://lh3.googleusercontent.com/a/abc=s96-c", prefix), "https://lh3.googleusercontent.com/a/abc=s96-c");
  for (const bad of [
    "https://evil.com/a.png", "http://lh3.googleusercontent.com/a", "javascript:alert(1)", "data:image/png;base64,AA",
    `${prefix}articles/2026/10/123e4567-e89b-42d3-a456-426614174000.png`, `${prefix}avatars/../x.png`, null,
  ]) assert.equal(safeAvatarSrc(bad, prefix), null, String(bad));
});

t("reserved category slugs (Phase 5 routes)", () => {
  for (const slug of ["login", "signup", "account", "forgot-password", "reset-password", "og"]) assert.ok(isReservedCategorySlug(slug), slug);
});

console.log(`\n${passed} test groups passed`);
