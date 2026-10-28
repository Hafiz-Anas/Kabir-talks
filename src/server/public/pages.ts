import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { type SitePageSlug, sitePages } from "@/db/schema";
import { cacheTags } from "@/lib/cache-tags";

/** Privacy Policy / Terms of Use for the public pages. Cached; the admin's save expires it. */
export async function getSitePage(slug: SitePageSlug) {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.pages);
  const [row] = await db
    .select({
      titleEn: sitePages.titleEn,
      titleUr: sitePages.titleUr,
      bodyEn: sitePages.bodyEn,
      bodyUr: sitePages.bodyUr,
      updatedAt: sitePages.updatedAt,
    })
    .from(sitePages)
    .where(eq(sitePages.slug, slug))
    .limit(1);
  return row ? { ...row, updatedAt: row.updatedAt.toISOString() } : null;
}
