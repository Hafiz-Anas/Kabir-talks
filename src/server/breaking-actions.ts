"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { articles, breakingNews } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { BREAKING_MAX_DAYS, breakingInputSchema, safeHttpsUrl } from "@/lib/breaking";
import { cacheTags } from "@/lib/cache-tags";

/** Breaking-news mutations (Phase 7C). requireAdmin() + Zod on every action. */

export type BreakingResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveBreaking(input: unknown): Promise<BreakingResult> {
  const session = await requireAdmin();
  const parsed = breakingInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path.at(-1) ?? "form")] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() > Date.now() + BREAKING_MAX_DAYS * 86_400_000) {
    return { ok: false, error: `Expiry can be at most ${BREAKING_MAX_DAYS} days ahead.`, fieldErrors: { expiresAt: "Too far ahead" } };
  }
  // A new live item that has already expired would never show: almost certainly a mistake.
  if (expiresAt && expiresAt.getTime() <= Date.now() && data.isActive && !data.id) {
    return { ok: false, error: "The expiry time is in the past.", fieldErrors: { expiresAt: "Choose a future time" } };
  }

  let articleId: string | null = null;
  let linkUrl: string | null = null;
  if (data.link.kind === "article") {
    const [article] = await db.select({ id: articles.id, status: articles.status }).from(articles).where(eq(articles.id, data.link.articleId));
    if (!article || article.status !== "PUBLISHED") {
      return { ok: false, error: "Link to a published article.", fieldErrors: { articleId: "Not a published article" } };
    }
    articleId = article.id;
  } else if (data.link.kind === "url") {
    linkUrl = safeHttpsUrl(data.link.url);
  }

  const values = { textEn: data.textEn, textUr: data.textUr, articleId, linkUrl, isActive: data.isActive, expiresAt, updatedAt: new Date() };
  let id: string;
  if (data.id) {
    const [row] = await db.update(breakingNews).set(values).where(eq(breakingNews.id, data.id)).returning({ id: breakingNews.id });
    if (!row) return { ok: false, error: "This item no longer exists." };
    id = row.id;
  } else {
    const [row] = await db.insert(breakingNews).values({ ...values, createdBy: session.user.id }).returning({ id: breakingNews.id });
    id = row.id;
  }
  updateTag(cacheTags.breaking);
  return { ok: true, id };
}

export async function setBreakingActive(input: { id: string; isActive: boolean }): Promise<BreakingResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const [row] = await db
    .update(breakingNews)
    .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
    .where(eq(breakingNews.id, parsed.data.id))
    .returning({ id: breakingNews.id });
  if (!row) return { ok: false, error: "This item no longer exists." };
  updateTag(cacheTags.breaking);
  return { ok: true, id: row.id };
}

export async function deleteBreaking(input: { id: string }): Promise<BreakingResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await db.delete(breakingNews).where(eq(breakingNews.id, parsed.data.id));
  updateTag(cacheTags.breaking);
  return { ok: true, id: parsed.data.id };
}

export type ArticlePickerOption = { id: string; titleEn: string | null; titleUr: string | null };

/** Searchable picker: published articles by title (either language), newest first. */
export async function searchPublishedArticles(input: { q: string }): Promise<ArticlePickerOption[]> {
  await requireAdmin();
  const parsed = z.object({ q: z.string().trim().max(100) }).safeParse(input);
  if (!parsed.success) return [];
  const pattern = `%${parsed.data.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return db
    .select({ id: articles.id, titleEn: articles.titleEn, titleUr: articles.titleUr })
    .from(articles)
    .where(
      and(
        eq(articles.status, "PUBLISHED"),
        parsed.data.q ? or(ilike(articles.titleEn, pattern), ilike(articles.titleUr, pattern)) : undefined,
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(10);
}
