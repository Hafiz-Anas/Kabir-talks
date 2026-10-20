import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only: bounces visitors with no session cookie away from
 * /admin before any rendering happens. It does NOT verify the session or the
 * role — the real authorization is requireAdmin() in the admin layout, pages
 * and server actions.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl;
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
