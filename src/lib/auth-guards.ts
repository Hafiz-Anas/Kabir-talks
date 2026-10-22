import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { loginPath } from "@/lib/urls";

/**
 * Server-side auth helpers. These are the ONLY source of truth for access
 * control: hiding links in the UI is never enough.
 *
 * Call `requireAdmin()` at the top of every admin layout, page, server action
 * and route handler. Under Cache Components, pages/layouts must call these
 * from inside a <Suspense> boundary because they read request headers.
 */

/** Current session or null. Deduplicated per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Signed-in user (any role). Redirects to the localized sign-in page otherwise. */
export async function requireUser(next: string, locale: Locale = "en") {
  const session = await getSession();
  if (!session) redirect(loginPath(locale, next));
  return session;
}

/**
 * Signed-in admin. Logged-out visitors are sent to /en/login; signed-in
 * non-admins get a 404 so the admin area isn't advertised.
 */
export async function requireAdmin(next = "/admin") {
  const session = await getSession();
  if (!session) redirect(loginPath("en", next));
  if (session.user.role !== "admin") notFound();
  return session;
}
