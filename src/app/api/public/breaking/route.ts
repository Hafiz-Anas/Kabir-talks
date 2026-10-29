import { locales } from "@/i18n/config";
import { publicBreaking } from "@/server/breaking";

/**
 * GET /api/public/breaking?locale=en  →  { items: [{ id, text, href }] }
 * Live breaking-news items in one language, newest first (Phase 7C). The bar
 * loads this in the browser so every page stays static. Public, identical for
 * every visitor, and cached for 30 s (the underlying read too), so admin
 * changes show within about a minute.
 */
export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale");
  if (!locales.includes(locale as (typeof locales)[number])) return Response.json({ error: "Invalid request" }, { status: 400 });
  const items = await publicBreaking(locale as (typeof locales)[number]);
  return Response.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=30" } },
  );
}
