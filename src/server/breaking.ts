import "server-only";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, breakingNews, categories } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import type { PublicBreakingItem } from "@/lib/breaking";
import { requireAdmin } from "@/lib/auth-guards";
import { cacheTags } from "@/lib/cache-tags";
import { articlePath } from "@/lib/urls";

import { availableIn } from "./public/articles";

/**
 * Breaking-news reads (Phase 7C). The public bar loads in the browser from
 * /api/public/breaking, so pages stay static; that endpoint reads through the
 * short cache below, which the admin actions expire (cacheTags.breaking).
 */

/** Live items, newest first, with each language's link resolved. Cached about 30 s. */
async function liveBreaking() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag(cacheTags.breaking);

  const rows = await db
    .select({
      id: breakingNews.id,
      textEn: breakingNews.textEn,
      textUr: breakingNews.textUr,
      linkUrl: breakingNews.linkUrl,
      expiresAt: breakingNews.expiresAt,
      // The article link counts only while it is published, and per language only where it's available.
      articleSlug: articles.slug,
      categorySlug: categories.slug,
      articleEn: sql<boolean>`coalesce(${articles.status} = 'PUBLISHED' and ${availableIn("en")}, false)`,
      articleUr: sql<boolean>`coalesce(${articles.status} = 'PUBLISHED' and ${availableIn("ur")}, false)`,
    })
    .from(breakingNews)
    .leftJoin(articles, eq(articles.id, breakingNews.articleId))
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .where(and(eq(breakingNews.isActive, true), or(isNull(breakingNews.expiresAt), gt(breakingNews.expiresAt, sql`now()`))))
    .orderBy(desc(breakingNews.createdAt))
    .limit(10);

  return rows.map((row) => ({ ...row, expiresAt: row.expiresAt?.toISOString() ?? null }));
}

/**
 * What the bar shows in one language: items with text in that language that
 * haven't expired (checked again here, since the cached list can be up to a
 * minute old).
 */
export async function publicBreaking(locale: Locale, now = Date.now()): Promise<PublicBreakingItem[]> {
  const rows = await liveBreaking();
  return rows.flatMap((row) => {
    const text = (locale === "en" ? row.textEn : row.textUr)?.trim();
    if (!text || (row.expiresAt && new Date(row.expiresAt).getTime() <= now)) return [];
    const articleOk = locale === "en" ? row.articleEn : row.articleUr;
    const href =
      row.linkUrl ?? (articleOk && row.articleSlug && row.categorySlug ? articlePath(locale, row.categorySlug, row.articleSlug) : null);
    return [{ id: row.id, text, href }];
  });
}

/** Admin list: everything, newest first, with the linked article's title. */
export async function listBreakingAdmin() {
  await requireAdmin();
  return db
    .select({
      id: breakingNews.id,
      textEn: breakingNews.textEn,
      textUr: breakingNews.textUr,
      articleId: breakingNews.articleId,
      linkUrl: breakingNews.linkUrl,
      isActive: breakingNews.isActive,
      expiresAt: breakingNews.expiresAt,
      expired: sql<boolean>`coalesce(${breakingNews.expiresAt} <= now(), false)`,
      createdAt: breakingNews.createdAt,
      articleTitle: sql<string | null>`coalesce(${articles.titleEn}, ${articles.titleUr})`,
      articleStatus: articles.status,
    })
    .from(breakingNews)
    .leftJoin(articles, eq(articles.id, breakingNews.articleId))
    .orderBy(desc(breakingNews.createdAt))
    .limit(200);
}

export type AdminBreakingRow = Awaited<ReturnType<typeof listBreakingAdmin>>[number];
