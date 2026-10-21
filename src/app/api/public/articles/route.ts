import { z } from "zod";

import { locales } from "@/i18n/config";
import { FEED_PAGE_SIZE } from "@/lib/articles/public";
import { listArticleCards } from "@/server/public/articles";

/**
 * GET /api/public/articles?locale=en&offset=6&exclude=<id>,<id>
 * Next page of the homepage "Latest" feed. Published, locale-available
 * articles only (same public read as the page). No auth, no writes.
 * Not CDN-cached, so a newly published story shows up straight away; the
 * underlying read is cached and expired by the admin's revalidation tags.
 */

const querySchema = z.object({
  locale: z.enum(locales),
  offset: z.coerce.number().int().min(0).max(1000),
  exclude: z
    .string()
    .max(400)
    .optional()
    .transform((value) => (value ? value.split(",") : []))
    .pipe(z.array(z.uuid()).max(10)),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { locale, offset, exclude } = parsed.data;

  // One extra row tells us whether there is another page.
  const rows = await listArticleCards({ locale, excludeIds: exclude, offset, limit: FEED_PAGE_SIZE + 1 });
  return Response.json({ items: rows.slice(0, FEED_PAGE_SIZE), hasMore: rows.length > FEED_PAGE_SIZE });
}
