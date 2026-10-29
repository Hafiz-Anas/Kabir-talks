import "server-only";

import { asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { cleanSocialLinks } from "@/lib/social";

/** ADMIN author reads (Phase 7C). Mutations: ./author-actions.ts. Public reads: ./public/authors.ts. */

export async function listAuthorsAdmin() {
  await requireAdmin();
  const rows = await db
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
      isDefault: authors.isDefault,
      articleCount: count(articles.id),
    })
    .from(authors)
    .leftJoin(articles, eq(articles.authorProfileId, authors.id))
    .groupBy(authors.id)
    .orderBy(desc(authors.isDefault), asc(authors.nameEn));
  return rows.map((row) => ({ ...row, socialLinks: cleanSocialLinks(row.socialLinks) }));
}

export type AdminAuthorRow = Awaited<ReturnType<typeof listAuthorsAdmin>>[number];

/** Choices for the article editor's author selector; the main author first. */
export async function listAuthorOptions() {
  await requireAdmin();
  return db
    .select({ id: authors.id, nameEn: authors.nameEn, nameUr: authors.nameUr, isDefault: authors.isDefault })
    .from(authors)
    .orderBy(desc(authors.isDefault), asc(authors.nameEn));
}

export type AuthorOption = Awaited<ReturnType<typeof listAuthorOptions>>[number];
