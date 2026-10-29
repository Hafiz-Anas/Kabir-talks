import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { cacheTags } from "@/lib/cache-tags";
import { cleanSocialLinks } from "@/lib/social";

import { availableIn, isPublished } from "./articles";

/**
 * PUBLIC author reads (Phase 7C). Author pages exist for every author, in
 * both languages; their article lists use listArticleCards({ authorId }).
 * Cached; author edits expire cacheTags.authors.
 */

export async function getPublicAuthor(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.authors);
  const [row] = await db
    .select({
      id: authors.id,
      slug: authors.slug,
      nameEn: authors.nameEn,
      nameUr: authors.nameUr,
      titleEn: authors.titleEn,
      titleUr: authors.titleUr,
      bioEn: authors.bioEn,
      bioUr: authors.bioUr,
      photoUrl: authors.photoUrl,
      socialLinks: authors.socialLinks,
    })
    .from(authors)
    .where(eq(authors.slug, slug))
    .limit(1);
  return row ? { ...row, socialLinks: cleanSocialLinks(row.socialLinks) } : null;
}

export async function listPublicAuthorSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.authors);
  return (await db.select({ slug: authors.slug }).from(authors).orderBy(asc(authors.slug)).limit(500)).map((row) => row.slug);
}

/** Authors with at least one published article, and in which languages (sitemap). */
export async function listSitemapAuthors() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.authors, cacheTags.articles);
  return db
    .select({
      slug: authors.slug,
      en: sql<boolean>`bool_or(${availableIn("en")})`,
      ur: sql<boolean>`bool_or(${availableIn("ur")})`,
      updatedAt: sql<Date>`greatest(max(${articles.updatedAt}), max(${authors.updatedAt}))`.mapWith((value) => new Date(value)),
    })
    .from(authors)
    .innerJoin(articles, eq(articles.authorProfileId, authors.id))
    .where(isPublished)
    .groupBy(authors.slug)
    .limit(1_000);
}
