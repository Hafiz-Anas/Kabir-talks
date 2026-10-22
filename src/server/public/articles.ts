import "server-only";

import { and, asc, count, desc, eq, notInArray, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, articleTags, categories, tags, user } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { type ArticleCardData, LISTING_PAGE_SIZE, type TagData } from "@/lib/articles/public";
import { isLocaleComplete } from "@/lib/articles/rules";
import { cacheTags } from "@/lib/cache-tags";
import { type ArticleDoc, countWords, docToPlainText, readingMinutes } from "@/lib/content/document";

/**
 * PUBLIC reads: published articles only, no auth, cached with "use cache".
 * Every page of the public site reads through this file. Admin mutations
 * expire the same tags (src/server/revalidate.ts), so publishing, editing or
 * unpublishing shows up immediately.
 *
 * Rules enforced here (and only here):
 *  - status = PUBLISHED on every query. Never add drafts/archived access —
 *    admin reads live in ../articles.ts.
 *  - Listings only include articles "available" in the requested locale:
 *    that locale has a title and a non-empty body (the publish checklist's
 *    isLocaleComplete rule, mirrored in SQL by availableIn()).
 */

export const isPublished = eq(articles.status, "PUBLISHED");

/** Mirrors isDocEmpty(): a document counts when it has visible text or media. */
const DOC_HAS_CONTENT =
  'strict $.** ? ((@.type == "text" && @.text like_regex "[^[:space:]]") || @.type == "image" || @.type == "youtube" || @.type == "tweet")';

export function availableIn(locale: Locale): SQL<boolean> {
  const title = locale === "en" ? articles.titleEn : articles.titleUr;
  const body = locale === "en" ? articles.bodyEn : articles.bodyUr;
  return sql<boolean>`(coalesce(btrim(${title}), '') <> '' and coalesce(jsonb_path_exists(${body}, ${DOC_HAS_CONTENT}), false))`;
}

function hasTag(tagSlug: string): SQL {
  return sql`exists (select 1 from ${articleTags} inner join ${tags} on ${tags.id} = ${articleTags.tagId}
    where ${articleTags.articleId} = ${articles.id} and ${tags.slug} = ${tagSlug})`;
}

const cardColumns = {
  id: articles.id,
  slug: articles.slug,
  titleEn: articles.titleEn,
  titleUr: articles.titleUr,
  excerptEn: articles.excerptEn,
  excerptUr: articles.excerptUr,
  bodyEn: articles.bodyEn,
  bodyUr: articles.bodyUr,
  coverImageUrl: articles.coverImageUrl,
  coverImageAlt: articles.coverImageAlt,
  isFeatured: articles.isFeatured,
  publishedAt: articles.publishedAt,
  categorySlug: categories.slug,
  categoryNameEn: categories.nameEn,
  categoryNameUr: categories.nameUr,
};

export function selectCards() {
  return db.select(cardColumns).from(articles).innerJoin(categories, eq(categories.id, articles.categoryId));
}

type CardRow = Awaited<ReturnType<typeof selectCards>>[number];

/** Localizes a row into card data. Null if the locale isn't complete (belt and braces). */
function toCard(row: CardRow, locale: Locale): ArticleCardData | null {
  const title = locale === "en" ? row.titleEn : row.titleUr;
  const body = (locale === "en" ? row.bodyEn : row.bodyUr) as ArticleDoc | null;
  if (!row.publishedAt || !title || !isLocaleComplete({ title, body })) return null;
  return {
    id: row.id,
    slug: row.slug,
    categorySlug: row.categorySlug,
    categoryName: locale === "en" ? row.categoryNameEn : row.categoryNameUr,
    title: title.trim(),
    excerpt: (locale === "en" ? row.excerptEn : row.excerptUr)?.trim() || null,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    isFeatured: row.isFeatured,
    publishedAt: row.publishedAt.toISOString(),
    readingMinutes: readingMinutes(countWords(docToPlainText(body)), locale),
  };
}

export function toCards(rows: CardRow[], locale: Locale) {
  return rows.map((row) => toCard(row, locale)).filter((card): card is ArticleCardData => card !== null);
}

export const newestFirst = [desc(articles.publishedAt), desc(articles.id)];

export type ListOptions = {
  locale: Locale;
  categorySlug?: string;
  tagSlug?: string;
  featuredOnly?: boolean;
  excludeIds?: string[];
  limit?: number;
  offset?: number;
};

function listWhere(options: ListOptions) {
  return and(
    isPublished,
    availableIn(options.locale),
    options.categorySlug ? eq(categories.slug, options.categorySlug) : undefined,
    options.tagSlug ? hasTag(options.tagSlug) : undefined,
    options.featuredOnly ? eq(articles.isFeatured, true) : undefined,
    options.excludeIds?.length ? notInArray(articles.id, options.excludeIds) : undefined,
  );
}

/** Newest-first cards for homepage sections, category and tag pages, and "Load more". */
export async function listArticleCards(options: ListOptions): Promise<ArticleCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);
  if (options.categorySlug) cacheTag(cacheTags.category(options.categorySlug));

  const rows = await selectCards()
    .where(listWhere(options))
    .orderBy(...newestFirst)
    .limit(Math.min(options.limit ?? LISTING_PAGE_SIZE, 50))
    .offset(Math.max(options.offset ?? 0, 0));
  return toCards(rows, options.locale);
}

export async function countArticles(options: Pick<ListOptions, "locale" | "categorySlug" | "tagSlug">) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);
  if (options.categorySlug) cacheTag(cacheTags.category(options.categorySlug));

  const [row] = await db
    .select({ total: count() })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(listWhere(options));
  return row?.total ?? 0;
}

/**
 * One published article by slug (slugs are unique site-wide), with both
 * languages so the page knows which locales exist. The page compares the
 * category slug and redirects if the URL used an old one.
 */
export async function getPublishedArticle(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);

  const [row] = await db
    .select({
      ...cardColumns,
      updatedAt: articles.updatedAt,
      seoTitleEn: articles.seoTitleEn,
      seoTitleUr: articles.seoTitleUr,
      seoDescriptionEn: articles.seoDescriptionEn,
      seoDescriptionUr: articles.seoDescriptionUr,
      authorName: user.name,
    })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .innerJoin(user, eq(user.id, articles.authorId))
    .where(and(isPublished, eq(articles.slug, slug)))
    .limit(1);
  if (!row?.publishedAt) return null;
  cacheTag(cacheTags.article(row.id), cacheTags.category(row.categorySlug));

  const articleTagRows: TagData[] = await db
    .select({ id: tags.id, slug: tags.slug, nameEn: tags.nameEn, nameUr: tags.nameUr })
    .from(articleTags)
    .innerJoin(tags, eq(tags.id, articleTags.tagId))
    .where(eq(articleTags.articleId, row.id))
    .orderBy(asc(tags.nameEn));

  const content = (locale: Locale) => {
    const card = toCard(row, locale);
    if (!card) return null;
    return {
      ...card,
      body: (locale === "en" ? row.bodyEn : row.bodyUr) as ArticleDoc,
      seoTitle: (locale === "en" ? row.seoTitleEn : row.seoTitleUr)?.trim() || null,
      seoDescription: (locale === "en" ? row.seoDescriptionEn : row.seoDescriptionUr)?.trim() || null,
    };
  };

  return {
    id: row.id,
    slug: row.slug,
    categorySlug: row.categorySlug,
    categoryNameEn: row.categoryNameEn,
    categoryNameUr: row.categoryNameUr,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.authorName,
    tags: articleTagRows,
    /** Null for a locale the article isn't available in. */
    locales: { en: content("en"), ur: content("ur") },
  };
}

export type PublicArticle = NonNullable<Awaited<ReturnType<typeof getPublishedArticle>>>;
export type PublicArticleContent = NonNullable<PublicArticle["locales"]["en"]>;

/** Up to `limit` related cards: same category first, then shared tags, then latest. */
export async function listRelatedArticles(articleId: string, locale: Locale, limit = 4) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);

  const [current] = await db
    .select({ categoryId: articles.categoryId })
    .from(articles)
    .where(and(isPublished, eq(articles.id, articleId)));
  if (!current) return [];

  const picked: ArticleCardData[] = [];
  const fill = async (extra: SQL | undefined) => {
    if (picked.length >= limit) return;
    const rows = await selectCards()
      .where(
        and(
          isPublished,
          availableIn(locale),
          notInArray(articles.id, [articleId, ...picked.map((card) => card.id)]),
          extra,
        ),
      )
      .orderBy(...newestFirst)
      .limit(limit - picked.length);
    picked.push(...toCards(rows, locale));
  };

  await fill(eq(articles.categoryId, current.categoryId));
  await fill(
    sql`exists (select 1 from ${articleTags} as mine inner join ${articleTags} as theirs on theirs.tag_id = mine.tag_id
      where mine.article_id = ${articleId} and theirs.article_id = ${articles.id})`,
  );
  await fill(undefined);
  return picked;
}

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAGE_SIZE = 10;

/**
 * Normalizes a search query: strips control characters, maps Arabic-keyboard
 * letters to their Urdu forms (ي → ی, ك → ک), collapses spaces, caps length.
 */
export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH);
}

function searchWhere(locale: Locale, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const title = locale === "en" ? articles.titleEn : articles.titleUr;
  const excerpt = locale === "en" ? articles.excerptEn : articles.excerptUr;
  // Fold Arabic-keyboard letters in stored text the same way as the query.
  const fold = (value: SQL) => sql`translate(coalesce(${value}, ''), 'يك', 'یک')`;
  return and(
    isPublished,
    availableIn(locale),
    sql`(${fold(sql`${title}`)} ilike ${pattern} or ${fold(sql`${excerpt}`)} ilike ${pattern} or exists (
      select 1 from ${articleTags} inner join ${tags} on ${tags.id} = ${articleTags.tagId}
      where ${articleTags.articleId} = ${articles.id}
        and (${tags.nameEn} ilike ${pattern} or ${fold(sql`${tags.nameUr}`)} ilike ${pattern})))`,
  );
}

/** Case-insensitive search over title, excerpt and tag names in one locale. `query` must be normalized. */
export async function searchArticles(locale: Locale, query: string, page: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.articles);

  if (query.length < SEARCH_MIN_LENGTH) return { items: [] as ArticleCardData[], total: 0 };
  const where = searchWhere(locale, query);
  const [rows, [{ total }]] = await Promise.all([
    selectCards()
      .where(where)
      .orderBy(...newestFirst)
      .limit(SEARCH_PAGE_SIZE)
      .offset((page - 1) * SEARCH_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(articles)
      .innerJoin(categories, eq(categories.id, articles.categoryId))
      .where(where),
  ]);
  return { items: toCards(rows, locale), total };
}

export async function listPublicCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.categories);
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameEn: categories.nameEn,
      nameUr: categories.nameUr,
      descriptionEn: categories.descriptionEn,
      descriptionUr: categories.descriptionUr,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.nameEn));
}

export type PublicCategory = Awaited<ReturnType<typeof listPublicCategories>>[number];

export async function getPublicCategory(slug: string) {
  const all = await listPublicCategories();
  return all.find((category) => category.slug === slug) ?? null;
}

/** A tag, only if at least one published article uses it. */
export async function getPublicTag(slug: string): Promise<TagData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);

  const [row] = await db
    .select({ id: tags.id, slug: tags.slug, nameEn: tags.nameEn, nameUr: tags.nameUr })
    .from(tags)
    .where(
      and(
        eq(tags.slug, slug),
        sql`exists (select 1 from ${articleTags} inner join ${articles} on ${articles.id} = ${articleTags.articleId}
          where ${articleTags.tagId} = ${tags.id} and ${articles.status} = 'PUBLISHED')`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Article params to prerender at build time: each (locale, category, slug)
 * that is available. Anything else renders on its first request.
 */
export async function listArticleStaticParams(limit = 200) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);

  const rows = await db
    .select({ slug: articles.slug, categorySlug: categories.slug, en: availableIn("en"), ur: availableIn("ur") })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(isPublished)
    .orderBy(...newestFirst)
    .limit(limit);
  return rows.flatMap((row) =>
    (["en", "ur"] as const)
      .filter((locale) => row[locale])
      .map((locale) => ({ locale, categorySlug: row.categorySlug, articleSlug: row.slug })),
  );
}

/** Slugs of tags used by published articles (for prerendering tag pages). */
export async function listPublicTagSlugs(limit = 200) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.articles);

  const rows = await db
    .selectDistinct({ slug: tags.slug })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .where(isPublished)
    .limit(limit);
  return rows.map((row) => row.slug);
}
