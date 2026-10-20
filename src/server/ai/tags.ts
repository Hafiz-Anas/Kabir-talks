import "server-only";

import { asc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { tags } from "@/db/schema";
import { LIMITS } from "@/lib/articles/rules";
import { slugify } from "@/lib/articles/slug";
import type { TagSuggestions } from "@/lib/ai/tasks";

/**
 * Turns AI tag names into suggestions: names that match an existing tag (by
 * slug) point to it; the rest are offered as new names, which are only
 * created if the admin clicks them and saves. Callers have run requireAdmin().
 */
export async function matchTags(names: string[]): Promise<TagSuggestions> {
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim().slice(0, LIMITS.tagName);
    const slug = slugify(name, 60);
    // New tags need a Latin-letter name (same rule as the editor's tag input).
    if (slug && /[A-Za-z0-9]/.test(name) && !bySlug.has(slug)) bySlug.set(slug, name);
  }
  if (!bySlug.size) return { existing: [], new: [] };

  const found = await db
    .select({ id: tags.id, slug: tags.slug, nameEn: tags.nameEn, nameUr: tags.nameUr })
    .from(tags)
    .where(inArray(tags.slug, [...bySlug.keys()]))
    .orderBy(asc(tags.nameEn));
  const foundSlugs = new Set(found.map((tag) => tag.slug));

  return {
    existing: found.map(({ id, nameEn, nameUr }) => ({ id, nameEn, nameUr })),
    new: [...bySlug].filter(([slug]) => !foundSlugs.has(slug)).map(([, name]) => name),
  };
}

/** Existing tag names, to steer the model towards reusing them. */
export async function existingTagNames(limit = 200): Promise<string[]> {
  const rows = await db.select({ nameEn: tags.nameEn }).from(tags).orderBy(asc(tags.nameEn)).limit(limit);
  return rows.map((row) => row.nameEn);
}
