import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { ARTICLE_PATH_HEADER } from "@/lib/urls";

/**
 * Two jobs, both cheap (no database, no session lookup):
 *
 * 1. /admin: optimistic check only — bounces visitors with no session cookie
 *    to /login before any rendering. It does NOT verify the session or the
 *    role; the real authorization is requireAdmin() in the admin layout,
 *    pages and server actions.
 *
 * 2. Article URLs (/{locale}/{category}/{slug}): passes the path to the
 *    article's not-found page, which can't read route params. That page uses
 *    it to say "only available in English/Urdu" with a link, instead of a
 *    bare 404, when the article exists in the other language.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!getSessionCookie(request)) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set(ARTICLE_PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/(en|ur)/:category/:slug"],
};
