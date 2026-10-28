import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, articleTags, categories, tags } from "@/db/schema";
import { cacheTags } from "@/lib/cache-tags";

import { availableIn, isPublished, newestFirst } from "./articles";

/**
 * Reads for the sitemaps (Phase 7). Published articles only, and each URL
 * only in the languages it is available in. Cached; publishing expires them.
 */

export async function listSitemapArticles(limit = 45_000) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);
  return db
    .select({
      slug: articles.slug,
      categorySlug: categories.slug,
      titleEn: articles.titleEn,
      titleUr: articles.titleUr,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      en: availableIn("en"),
      ur: availableIn("ur"),
    })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(isPublished)
    .orderBy(...newestFirst)
    .limit(limit);
}

/** Articles published in the last 48 hours (Google News sitemap). */
export async function listNewsArticles() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 86_400 });
  cacheTag(cacheTags.articles);
  return db
    .select({
      slug: articles.slug,
      categorySlug: categories.slug,
      titleEn: articles.titleEn,
      titleUr: articles.titleUr,
      publishedAt: articles.publishedAt,
      en: availableIn("en"),
      ur: availableIn("ur"),
    })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(and(isPublished, gte(articles.publishedAt, sql`now() - interval '48 hours'`)))
    .orderBy(...newestFirst)
    .limit(1_000);
}

/** Tags with at least one published article, and in which languages they have one. */
export async function listSitemapTags() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);
  return db
    .select({
      slug: tags.slug,
      en: sql<boolean>`bool_or(${availableIn("en")})`,
      ur: sql<boolean>`bool_or(${availableIn("ur")})`,
      updatedAt: sql<Date>`max(${articles.updatedAt})`.mapWith((value) => new Date(value)),
    })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(isPublished)
    .groupBy(tags.slug)
    .limit(5_000);
}
