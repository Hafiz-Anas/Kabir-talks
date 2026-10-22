import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { PAGED_SEGMENT } from "@/lib/urls";

/**
 * Two cheap jobs (no database, no session lookup):
 *
 * 1. /admin: optimistic check only — bounces visitors with no session cookie
 *    to /en/login before any rendering. It does NOT verify the session or the
 *    role; the real authorization is requireAdmin() in the admin layout,
 *    pages and server actions.
 *
 * 2. Listing pagination: the public URL /en/sports?page=2 is rewritten to the
 *    static route /en/sports/p/2, so section and tag pages never read
 *    searchParams and can return real 404s. ?page=1 and direct /p/N visits
 *    redirect to the one public form.
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!getSessionCookie(request)) {
      const url = new URL("/en/login", request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const isTag = segments[1] === "tags";
  const base = segments.slice(0, isTag ? 3 : 2);

  // Direct visit to the internal route: /en/sports/p/2 → /en/sports?page=2
  if (segments.at(-2) === PAGED_SEGMENT && segments.length === base.length + 2) {
    const url = request.nextUrl.clone();
    url.pathname = `/${base.join("/")}`;
    url.searchParams.set("page", segments.at(-1)!);
    return NextResponse.redirect(url, 308);
  }

  // Only listing URLs (/en/sports, /en/tags/cricket) — never /en/search.
  const page = searchParams.get("page");
  if (page === null || segments[1] === "search" || segments.length !== base.length) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.delete("page");
  if (page === "1") return NextResponse.redirect(url, 308);
  // Anything else (2, 3, "abc", "0") goes to the static route, which 404s if invalid.
  url.pathname = `${pathname}/${PAGED_SEGMENT}/${encodeURIComponent(page)}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    { source: "/(en|ur)/:section", has: [{ type: "query", key: "page" }] },
    { source: "/(en|ur)/tags/:tag", has: [{ type: "query", key: "page" }] },
    "/(en|ur)/:section/p/:page",
    "/(en|ur)/tags/:tag/p/:page",
  ],
};
