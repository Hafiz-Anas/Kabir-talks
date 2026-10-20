import "server-only";

import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { articles, articleTags, categories, tags } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

/**
 * ADMIN article reads. Every function calls requireAdmin() and can return
 * drafts/archived rows. Public (published-only) reads live in
 * src/server/public/articles.ts. Mutations live in ./article-actions.ts.
 */

export const ARTICLES_PAGE_SIZE = 20;

export const articleListParamsSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  sort: z.enum(["updated", "published"]).default("updated").catch("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type ArticleListParams = z.infer<typeof articleListParamsSchema>;

/** Escape LIKE wildcards so a search for "50%" matches literally. */
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listArticlesAdmin(params: ArticleListParams) {
  await requireAdmin();

  const filters: SQL[] = [];
  if (params.status) filters.push(eq(articles.status, params.status));
  if (params.category) filters.push(eq(articles.categoryId, params.category));
  if (params.q) {
    const pattern = likePattern(params.q);
    filters.push(or(ilike(articles.titleEn, pattern), ilike(articles.titleUr, pattern))!);
  }
  const where = filters.length ? and(...filters) : undefined;

  const order =
    params.sort === "published"
      ? [sql`${articles.publishedAt} desc nulls last`, desc(articles.updatedAt)]
      : [desc(articles.updatedAt)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        titleEn: articles.titleEn,
        titleUr: articles.titleUr,
        status: articles.status,
        isFeatured: articles.isFeatured,
        updatedAt: articles.updatedAt,
        publishedAt: articles.publishedAt,
        categoryId: articles.categoryId,
        categorySlug: categories.slug,
        categoryNameEn: categories.nameEn,
        hasBodyEn: sql<boolean>`${articles.bodyEn} is not null`,
        hasBodyUr: sql<boolean>`${articles.bodyUr} is not null`,
      })
      .from(articles)
      .innerJoin(categories, eq(categories.id, articles.categoryId))
      .where(where)
      .orderBy(...order)
      .limit(ARTICLES_PAGE_SIZE)
      .offset((params.page - 1) * ARTICLES_PAGE_SIZE),
    db.select({ total: count() }).from(articles).where(where),
  ]);

  return {
    rows,
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE)),
  };
}

export type AdminArticleRow = Awaited<ReturnType<typeof listArticlesAdmin>>["rows"][number];

export async function getDashboardData() {
  await requireAdmin();

  const [[stats], [{ categoryCount }], recent] = await Promise.all([
    db
      .select({
        total: count(),
        published: count(sql`case when ${articles.status} = 'PUBLISHED' then 1 end`),
        drafts: count(sql`case when ${articles.status} = 'DRAFT' then 1 end`),
        archived: count(sql`case when ${articles.status} = 'ARCHIVED' then 1 end`),
      })
      .from(articles),
    db.select({ categoryCount: count() }).from(categories),
    db
      .select({
        id: articles.id,
        titleEn: articles.titleEn,
        titleUr: articles.titleUr,
        status: articles.status,
        updatedAt: articles.updatedAt,
        categoryNameEn: categories.nameEn,
      })
      .from(articles)
      .innerJoin(categories, eq(categories.id, articles.categoryId))
      .orderBy(desc(articles.updatedAt))
      .limit(5),
  ]);

  return { stats: { ...stats, categories: categoryCount }, recent };
}

/** Full article for the editor, including its tags. Null if not found. */
export async function getArticleForEdit(id: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;

  const article = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!article) return null;

  const [category, articleTagRows] = await Promise.all([
    db.query.categories.findFirst({ where: eq(categories.id, article.categoryId) }),
    db
      .select({ id: tags.id, nameEn: tags.nameEn, nameUr: tags.nameUr, slug: tags.slug })
      .from(articleTags)
      .innerJoin(tags, eq(tags.id, articleTags.tagId))
      .where(eq(articleTags.articleId, id))
      .orderBy(asc(tags.nameEn)),
  ]);

  return { ...article, categorySlug: category?.slug ?? "", tags: articleTagRows };
}

export type EditableArticle = NonNullable<Awaited<ReturnType<typeof getArticleForEdit>>>;

/** Lookups the editor needs: categories and all existing tags. */
export async function getEditorOptions() {
  await requireAdmin();
  const [categoryRows, tagRows] = await Promise.all([
    db
      .select({ id: categories.id, slug: categories.slug, nameEn: categories.nameEn, nameUr: categories.nameUr })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.nameEn)),
    db
      .select({ id: tags.id, slug: tags.slug, nameEn: tags.nameEn, nameUr: tags.nameUr })
      .from(tags)
      .orderBy(asc(tags.nameEn))
      .limit(1000),
  ]);
  return { categories: categoryRows, tags: tagRows };
}

export type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;
