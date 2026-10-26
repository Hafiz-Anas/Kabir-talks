"use server";

import { randomBytes } from "node:crypto";

import { and, eq, inArray, ne } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { articles, articleTags, categories, tags } from "@/db/schema";
import { type ArticleStatus, completedLocales, missingForPublish, type ChecklistItem } from "@/lib/articles/rules";
import { isValidSlug, slugify } from "@/lib/articles/slug";
import { articlePayloadSchema, type FieldErrors, toFieldErrors } from "@/lib/articles/validation";
import { requireAdmin } from "@/lib/auth-guards";
import { type ArticleDoc, sanitizeDoc } from "@/lib/content/document";
import { safeImageSrc } from "@/lib/content/urls";
import { env } from "@/lib/env";
import type { Locale } from "@/i18n/config";
import { absoluteUrl, articlePath } from "@/lib/urls";

import { audioPathsOf, removeAudioFiles } from "./ai/audio";
import { refreshReaderAi } from "./ai/background";
import { revalidateArticle, revalidateArticlePages } from "./revalidate";
import { imagePrefix } from "./storage";

/**
 * Article mutations. Every action calls requireAdmin() first and validates
 * its input with Zod; bodies are sanitized against the Tiptap allow-list.
 */

export type SavedArticle = {
  id: string;
  slug: string;
  status: ArticleStatus;
  publishedAt: string | null;
  updatedAt: string;
  bodyEn: ArticleDoc | null;
  bodyUr: ArticleDoc | null;
  tags: { id: string; nameEn: string; nameUr: string | null; slug: string }[];
};

export type SaveArticleResult =
  | { ok: true; article: SavedArticle; removed: { en: string[]; ur: string[] } }
  | { ok: false; error: string; fieldErrors?: FieldErrors; needsSlugConfirm?: boolean; missing?: ChecklistItem[] };

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown, constraint: string) {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: string }).code === PG_UNIQUE_VIOLATION &&
    String((cause as { constraint_name?: string }).constraint_name ?? "").includes(constraint)
  );
}

async function slugTaken(slug: string, excludeId?: string) {
  const row = await db
    .select({ id: articles.id })
    .from(articles)
    .where(excludeId ? and(eq(articles.slug, slug), ne(articles.id, excludeId)) : eq(articles.slug, slug))
    .limit(1);
  return row.length > 0;
}

/** Live uniqueness check for the slug field. */
export async function checkSlugAvailability(input: { slug: string; excludeId?: string }) {
  await requireAdmin();
  const parsed = z.object({ slug: z.string().trim().max(200), excludeId: z.uuid().optional() }).safeParse(input);
  if (!parsed.success || !isValidSlug(parsed.data.slug)) return { available: false, valid: false };
  return { available: !(await slugTaken(parsed.data.slug, parsed.data.excludeId)), valid: true };
}

export async function saveArticle(input: unknown): Promise<SaveArticleResult> {
  const session = await requireAdmin();

  const parsed = articlePayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const data = parsed.data;
  const prefix = imagePrefix();

  if (!data.titleEn && !data.titleUr) {
    return {
      ok: false,
      error: "Add a title in English or Urdu before saving.",
      fieldErrors: { titleEn: "A title is required in at least one language" },
    };
  }

  const en = sanitizeDoc(data.bodyEn, { imagePrefix: prefix });
  const ur = sanitizeDoc(data.bodyUr, { imagePrefix: prefix });

  // Cover image: must be one of our uploads, and needs alt text.
  let coverImageUrl: string | null = null;
  if (data.coverImageUrl) {
    coverImageUrl = safeImageSrc(data.coverImageUrl, prefix);
    if (!coverImageUrl) {
      return { ok: false, error: "The cover image must be uploaded here.", fieldErrors: { coverImageUrl: "Invalid image" } };
    }
    if (!data.coverImageAlt) {
      return {
        ok: false,
        error: "Add alt text for the cover image.",
        fieldErrors: { coverImageAlt: "Alt text is required for accessibility" },
      };
    }
  }

  const category = await db.query.categories.findFirst({ where: eq(categories.id, data.categoryId) });
  if (!category) return { ok: false, error: "Choose a category.", fieldErrors: { categoryId: "Category not found" } };

  const existing = data.id
    ? await db.query.articles.findFirst({ where: eq(articles.id, data.id) })
    : undefined;
  if (data.id && !existing) return { ok: false, error: "This article no longer exists." };

  const slug = data.slug || slugify(data.titleEn ?? "") || `article-${randomBytes(4).toString("hex")}`;

  if (existing?.publishedAt && existing.slug !== slug && !data.confirmSlugChange) {
    return {
      ok: false,
      needsSlugConfirm: true,
      error: "This article has been published before. Changing its slug will break links that were already shared.",
    };
  }

  if (existing?.status === "PUBLISHED") {
    const missing = missingForPublish({
      categoryId: data.categoryId,
      slug,
      en: { title: data.titleEn, body: en.doc },
      ur: { title: data.titleUr, body: ur.doc },
      coverImageUrl,
      coverImageAlt: data.coverImageAlt,
      ai: { used: data.aiReviewPending, reviewed: false },
    });
    if (missing.length) {
      return {
        ok: false,
        error: "This article is live, so it must stay complete (and any AI content reviewed). Fix the items below or unpublish it first.",
        missing,
      };
    }
  }

  if (await slugTaken(slug, data.id)) {
    return {
      ok: false,
      error: "That slug is already used by another article.",
      fieldErrors: { slug: `“${slug}” is already taken — choose another` },
    };
  }

  const values = {
    categoryId: data.categoryId,
    slug,
    titleEn: data.titleEn,
    titleUr: data.titleUr,
    excerptEn: data.excerptEn,
    excerptUr: data.excerptUr,
    bodyEn: en.doc,
    bodyUr: ur.doc,
    coverImageUrl,
    coverImageAlt: coverImageUrl ? data.coverImageAlt : null,
    isFeatured: data.isFeatured,
    commentsEnabled: data.commentsEnabled,
    seoTitleEn: data.seoTitleEn,
    seoTitleUr: data.seoTitleUr,
    seoDescriptionEn: data.seoDescriptionEn,
    seoDescriptionUr: data.seoDescriptionUr,
    aiReviewPending: data.aiReviewPending,
    updatedAt: new Date(),
  };

  let saved: typeof articles.$inferSelect;
  let savedTags: SavedArticle["tags"];
  try {
    ({ saved, savedTags } = await db.transaction(async (tx) => {
      const [row] = existing
        ? await tx.update(articles).set(values).where(eq(articles.id, existing.id)).returning()
        : await tx.insert(articles).values({ ...values, authorId: session.user.id, status: "DRAFT" }).returning();

      // Tags: existing ones by id, new ones upserted by slug.
      const tagIds = new Set<string>();
      const existingIds = data.tags.flatMap((tag) => ("id" in tag ? [tag.id] : []));
      if (existingIds.length) {
        const found = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.id, existingIds));
        found.forEach((tag) => tagIds.add(tag.id));
      }
      for (const tag of data.tags) {
        if (!("name" in tag)) continue;
        const tagSlug = slugify(tag.name, 60);
        if (!tagSlug) continue;
        await tx.insert(tags).values({ slug: tagSlug, nameEn: tag.name }).onConflictDoNothing({ target: tags.slug });
        const [found] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, tagSlug));
        if (found) tagIds.add(found.id);
      }

      await tx.delete(articleTags).where(eq(articleTags.articleId, row.id));
      if (tagIds.size) {
        await tx.insert(articleTags).values([...tagIds].map((tagId) => ({ articleId: row.id, tagId })));
      }
      const tagRows = tagIds.size
        ? await tx
            .select({ id: tags.id, nameEn: tags.nameEn, nameUr: tags.nameUr, slug: tags.slug })
            .from(tags)
            .where(inArray(tags.id, [...tagIds]))
        : [];
      return { saved: row, savedTags: tagRows.sort((a, b) => a.nameEn.localeCompare(b.nameEn)) };
    }));
  } catch (error) {
    if (isUniqueViolation(error, "slug")) {
      return { ok: false, error: "That slug is already used by another article.", fieldErrors: { slug: "Already taken" } };
    }
    throw error;
  }

  // Live (or previously live) content changed: refresh public pages.
  if (saved.status === "PUBLISHED" || existing?.status === "PUBLISHED") {
    const previousCategory =
      existing && existing.categoryId !== saved.categoryId
        ? await db.query.categories.findFirst({ where: eq(categories.id, existing.categoryId) })
        : category;
    revalidateArticle(
      saved.id,
      { categorySlug: category.slug, slug: saved.slug },
      existing ? { categorySlug: previousCategory?.slug ?? category.slug, slug: existing.slug } : null,
    );
  }
  // Phase 6: refresh reader AI for the live text after the response; never blocks or fails the save.
  if (saved.status === "PUBLISHED") after(() => refreshReaderAi(saved.id));

  return {
    ok: true,
    article: {
      id: saved.id,
      slug: saved.slug,
      status: saved.status,
      publishedAt: saved.publishedAt?.toISOString() ?? null,
      updatedAt: saved.updatedAt.toISOString(),
      bodyEn: en.doc,
      bodyUr: ur.doc,
      tags: savedTags,
    },
    removed: { en: en.removed, ur: ur.removed },
  };
}

const idSchema = z.uuid();

async function loadWithCategory(id: unknown) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  const [row] = await db
    .select({ article: articles, categorySlug: categories.slug })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(eq(articles.id, parsed.data))
    .limit(1);
  return row ?? null;
}

export type PublishedInfo = {
  id: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string;
  links: { locale: Locale; url: string; title: string }[];
};

export type PublishResult =
  | { ok: true; info: PublishedInfo }
  | { ok: false; error: string; missing?: ChecklistItem[] };

export async function publishArticle(input: { id: string; updatePublishedAt?: boolean }): Promise<PublishResult> {
  await requireAdmin();
  const row = await loadWithCategory(input?.id);
  if (!row) return { ok: false, error: "Article not found." };
  const { article, categorySlug } = row;

  const readiness = {
    categoryId: article.categoryId,
    slug: article.slug,
    en: { title: article.titleEn, body: article.bodyEn as ArticleDoc | null },
    ur: { title: article.titleUr, body: article.bodyUr as ArticleDoc | null },
    coverImageUrl: article.coverImageUrl,
    coverImageAlt: article.coverImageAlt,
    // Never publish AI content the admin hasn't confirmed reviewing (stored, so the list's Publish respects it too).
    ai: { used: article.aiReviewPending, reviewed: false },
  };
  const missing = missingForPublish(readiness);
  if (missing.length) return { ok: false, error: "This article isn't ready to publish yet.", missing };

  const keepDate = article.publishedAt && !input.updatePublishedAt;
  const [updated] = await db
    .update(articles)
    .set({ status: "PUBLISHED", publishedAt: keepDate ? article.publishedAt : new Date(), updatedAt: new Date() })
    .where(eq(articles.id, article.id))
    .returning();

  revalidateArticle(article.id, { categorySlug, slug: article.slug });
  // Phase 6: summaries for each available language, generated after the response.
  after(() => refreshReaderAi(article.id));

  const locales = completedLocales(readiness);
  const primary = locales[0] ?? "en";
  return {
    ok: true,
    info: {
      id: article.id,
      title: (primary === "en" ? article.titleEn : article.titleUr) ?? "",
      excerpt: primary === "en" ? article.excerptEn : article.excerptUr,
      coverImageUrl: article.coverImageUrl,
      coverImageAlt: article.coverImageAlt,
      publishedAt: updated.publishedAt!.toISOString(),
      links: locales.map((locale) => ({
        locale,
        title: (locale === "en" ? article.titleEn : article.titleUr) ?? "",
        url: absoluteUrl(env.NEXT_PUBLIC_SITE_URL, articlePath(locale, categorySlug, article.slug)),
      })),
    },
  };
}

type SimpleResult = { ok: true } | { ok: false; error: string };

async function setStatus(id: unknown, status: "DRAFT" | "ARCHIVED"): Promise<SimpleResult> {
  await requireAdmin();
  const row = await loadWithCategory(id);
  if (!row) return { ok: false, error: "Article not found." };
  await db.update(articles).set({ status, updatedAt: new Date() }).where(eq(articles.id, row.article.id));
  revalidateArticle(row.article.id, { categorySlug: row.categorySlug, slug: row.article.slug });
  return { ok: true };
}

/** Back to DRAFT. publishedAt is kept so re-publishing preserves the original date. */
export async function unpublishArticle(input: { id: string }) {
  return setStatus(input?.id, "DRAFT");
}

export async function archiveArticle(input: { id: string }) {
  return setStatus(input?.id, "ARCHIVED");
}

/** Permanent delete (tags, bookmarks, comments, summaries, audio rows and views cascade; audio files are removed). */
export async function deleteArticle(input: { id: string }): Promise<SimpleResult> {
  await requireAdmin();
  const row = await loadWithCategory(input?.id);
  if (!row) return { ok: false, error: "Article not found." };
  const audioFiles = await audioPathsOf(row.article.id);
  await db.delete(articles).where(eq(articles.id, row.article.id));
  after(() => removeAudioFiles(audioFiles));
  revalidateArticle(row.article.id, { categorySlug: row.categorySlug, slug: row.article.slug });
  return { ok: true };
}

/**
 * Phase 6: after "Generate audio" the static article page must learn that
 * Listen now has audio (the editor calls this when generation succeeds).
 */
export async function refreshArticlePages(input: { id: string }): Promise<SimpleResult> {
  await requireAdmin();
  const row = await loadWithCategory(input?.id);
  if (!row) return { ok: false, error: "Article not found." };
  revalidateArticlePages(row.article.id, { categorySlug: row.categorySlug, slug: row.article.slug });
  return { ok: true };
}
