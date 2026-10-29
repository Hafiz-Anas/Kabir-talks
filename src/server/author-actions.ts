"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { slugify } from "@/lib/articles/slug";
import { requireAdmin } from "@/lib/auth-guards";
import { authorInputSchema } from "@/lib/authors";
import { safeImageSrc } from "@/lib/content/urls";

import { revalidateAuthors } from "./revalidate";
import { imagePrefix } from "./storage";

/** Author profile mutations (Phase 7C). requireAdmin() + Zod on every action. */

export type AuthorResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveAuthor(input: unknown): Promise<AuthorResult> {
  await requireAdmin();
  const parsed = authorInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path.at(-1) ?? "form")] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const slug = data.slug || slugify(data.nameEn, 80);
  if (!slug) return { ok: false, error: "Add a slug.", fieldErrors: { slug: "Use lowercase letters, numbers and hyphens" } };

  let photoUrl: string | null = null;
  if (data.photoUrl) {
    photoUrl = safeImageSrc(data.photoUrl, imagePrefix());
    if (!photoUrl) return { ok: false, error: "The photo must be uploaded here.", fieldErrors: { photoUrl: "Invalid image" } };
  }

  const existing = data.id ? await db.query.authors.findFirst({ where: eq(authors.id, data.id) }) : undefined;
  if (data.id && !existing) return { ok: false, error: "This author no longer exists." };
  if (existing?.isDefault && !data.isDefault) {
    return { ok: false, error: "There must always be a main author: make another author the main one instead.", fieldErrors: { isDefault: "Required" } };
  }

  const taken = await db
    .select({ id: authors.id })
    .from(authors)
    .where(data.id ? and(eq(authors.slug, slug), ne(authors.id, data.id)) : eq(authors.slug, slug))
    .limit(1);
  if (taken.length) return { ok: false, error: "That slug is already used by another author.", fieldErrors: { slug: `“${slug}” is already taken` } };

  const values = {
    slug,
    nameEn: data.nameEn,
    nameUr: data.nameUr,
    titleEn: data.titleEn,
    titleUr: data.titleUr,
    bioEn: data.bioEn,
    bioUr: data.bioUr,
    photoUrl,
    socialLinks: data.socialLinks,
    isDefault: data.isDefault,
    updatedAt: new Date(),
  };

  const id = await db.transaction(async (tx) => {
    // Only one main author: the new one takes over.
    if (data.isDefault) await tx.update(authors).set({ isDefault: false }).where(and(eq(authors.isDefault, true), data.id ? ne(authors.id, data.id) : undefined));
    if (existing) {
      await tx.update(authors).set(values).where(eq(authors.id, existing.id));
      return existing.id;
    }
    const [row] = await tx.insert(authors).values(values).returning({ id: authors.id });
    return row.id;
  });

  revalidateAuthors();
  return { ok: true, id };
}

export type DeleteAuthorResult = { ok: true; moved: number } | { ok: false; error: string; articleCount?: number };

/**
 * Deletes an author. One who still has articles can't be deleted until they
 * are reassigned: pass `reassignTo` to move them and delete in one
 * transaction. The main author can't be deleted (make another one main first).
 */
export async function deleteAuthor(input: { id: string; reassignTo?: string }): Promise<DeleteAuthorResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), reassignTo: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, reassignTo } = parsed.data;

  const author = await db.query.authors.findFirst({ where: eq(authors.id, id) });
  if (!author) return { ok: false, error: "Author not found." };
  if (author.isDefault) return { ok: false, error: "This is the main author. Make another author the main one before deleting." };

  const [{ articleCount }] = await db.select({ articleCount: count() }).from(articles).where(eq(articles.authorProfileId, id));
  if (articleCount > 0 && !reassignTo) {
    return {
      ok: false,
      articleCount,
      error: `This author has ${articleCount} article${articleCount === 1 ? "" : "s"}. Reassign them to another author first.`,
    };
  }
  if (articleCount > 0 && reassignTo) {
    if (reassignTo === id) return { ok: false, error: "Choose a different author to reassign the articles to." };
    const target = await db.query.authors.findFirst({ where: eq(authors.id, reassignTo), columns: { id: true } });
    if (!target) return { ok: false, error: "The author to reassign to was not found." };
  }

  await db.transaction(async (tx) => {
    if (articleCount > 0 && reassignTo) {
      await tx.update(articles).set({ authorProfileId: reassignTo, updatedAt: new Date() }).where(eq(articles.authorProfileId, id));
    }
    await tx.delete(authors).where(eq(authors.id, id));
  });

  revalidateAuthors();
  return { ok: true, moved: reassignTo ? articleCount : 0 };
}
