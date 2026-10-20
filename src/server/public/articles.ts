import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { cacheTags } from "@/lib/cache-tags";

/**
 * PUBLIC reads: published articles only, no auth, cached with "use cache".
 * Phase 4 pages build on these. Admin mutations expire the same tags
 * (src/server/revalidate.ts), so edits show up immediately.
 *
 * Never add drafts/archived access here — admin reads live in ../articles.ts.
 */

const publishedColumns = {
  id: articles.id,
  slug: articles.slug,
  titleEn: articles.titleEn,
  titleUr: articles.titleUr,
  excerptEn: articles.excerptEn,
  excerptUr: articles.excerptUr,
  coverImageUrl: articles.coverImageUrl,
  coverImageAlt: articles.coverImageAlt,
  isFeatured: articles.isFeatured,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  categorySlug: categories.slug,
  categoryNameEn: categories.nameEn,
  categoryNameUr: categories.nameUr,
};

export async function listPublishedArticles(options: { categorySlug?: string; limit?: number } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);
  if (options.categorySlug) cacheTag(cacheTags.category(options.categorySlug));

  return db
    .select(publishedColumns)
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(
      and(
        eq(articles.status, "PUBLISHED"),
        options.categorySlug ? eq(categories.slug, options.categorySlug) : undefined,
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(Math.min(options.limit ?? 20, 100));
}

/** One published article by category + slug, with bodies. Null if not published. */
export async function getPublishedArticle(categorySlug: string, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles, cacheTags.category(categorySlug));

  const [row] = await db
    .select({
      ...publishedColumns,
      bodyEn: articles.bodyEn,
      bodyUr: articles.bodyUr,
      seoTitleEn: articles.seoTitleEn,
      seoTitleUr: articles.seoTitleUr,
      seoDescriptionEn: articles.seoDescriptionEn,
      seoDescriptionUr: articles.seoDescriptionUr,
    })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(and(eq(articles.status, "PUBLISHED"), eq(articles.slug, slug), eq(categories.slug, categorySlug)))
    .limit(1);

  if (row) cacheTag(cacheTags.article(row.id));
  return row ?? null;
}

export async function listPublicCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.categories);
  return db
    .select({ id: categories.id, slug: categories.slug, nameEn: categories.nameEn, nameUr: categories.nameUr })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.nameEn));
}
