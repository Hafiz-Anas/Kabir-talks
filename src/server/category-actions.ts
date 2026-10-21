"use server";

import { and, asc, count, eq, max, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { isReservedCategorySlug, RESERVED_CATEGORY_SLUGS, SLUG_HELP, SLUG_PATTERN, slugify } from "@/lib/articles/slug";
import { requireAdmin } from "@/lib/auth-guards";

import { revalidateCategories } from "./revalidate";

/** Category mutations. Every action calls requireAdmin() and validates with Zod. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .default(null);

const categorySchema = z.object({
  id: z.uuid().optional(),
  nameEn: z.string().trim().min(1, "English name is required").max(80),
  nameUr: z.string().trim().min(1, "Urdu name is required").max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((value) => value === "" || SLUG_PATTERN.test(value), SLUG_HELP),
  descriptionEn: optionalText(500),
  descriptionUr: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type CategoryResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof CategoryInput, string>> };

export async function saveCategory(input: CategoryInput): Promise<CategoryResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof CategoryInput, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof CategoryInput] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const slug = data.slug || slugify(data.nameEn, 80);
  if (!slug) return { ok: false, error: "Add a slug.", fieldErrors: { slug: SLUG_HELP } };

  // Would collide with public routes (/en, /{locale}/search, /{locale}/tags, …).
  if (isReservedCategorySlug(slug)) {
    return {
      ok: false,
      error: "That slug is reserved.",
      fieldErrors: { slug: `Reserved — these can't be used: ${RESERVED_CATEGORY_SLUGS.join(", ")}` },
    };
  }

  const clash = await db
    .select({ id: categories.id })
    .from(categories)
    .where(data.id ? and(eq(categories.slug, slug), ne(categories.id, data.id)) : eq(categories.slug, slug))
    .limit(1);
  if (clash.length) {
    return { ok: false, error: "That slug is already used.", fieldErrors: { slug: `“${slug}” is already taken` } };
  }

  const values = {
    nameEn: data.nameEn,
    nameUr: data.nameUr,
    slug,
    descriptionEn: data.descriptionEn,
    descriptionUr: data.descriptionUr,
    updatedAt: new Date(),
  };

  if (data.id) {
    const previous = await db.query.categories.findFirst({ where: eq(categories.id, data.id) });
    if (!previous) return { ok: false, error: "Category not found." };
    await db
      .update(categories)
      .set({ ...values, ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}) })
      .where(eq(categories.id, data.id));
    revalidateCategories([previous.slug, slug]);
    return { ok: true, id: data.id };
  }

  const [{ maxOrder }] = await db.select({ maxOrder: max(categories.sortOrder) }).from(categories);
  const [created] = await db
    .insert(categories)
    .values({ ...values, sortOrder: data.sortOrder ?? (maxOrder ?? 0) + 1 })
    .returning({ id: categories.id });
  revalidateCategories([slug]);
  return { ok: true, id: created.id };
}

/** Swap a category with its neighbour, then renumber all sortOrders 1..n. */
export async function moveCategory(input: { id: string; direction: "up" | "down" }) {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid request." };

  const slugs = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.nameEn));
    const index = rows.findIndex((row) => row.id === parsed.data.id);
    const target = parsed.data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= rows.length) return [];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    for (const [position, row] of rows.entries()) {
      await tx.update(categories).set({ sortOrder: position + 1 }).where(eq(categories.id, row.id));
    }
    return rows.map((row) => row.slug);
  });

  if (slugs.length) revalidateCategories(slugs);
  return { ok: true as const };
}

export type DeleteCategoryResult =
  | { ok: true; moved: number }
  | { ok: false; error: string; articleCount?: number };

/**
 * Deletes a category. If it still has articles, `reassignTo` must name another
 * category: the articles move there and the category is deleted in one
 * transaction. (The database also blocks deletion via ON DELETE RESTRICT.)
 */
export async function deleteCategory(input: { id: string; reassignTo?: string }): Promise<DeleteCategoryResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid(), reassignTo: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, reassignTo } = parsed.data;

  const category = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!category) return { ok: false, error: "Category not found." };

  const [{ articleCount }] = await db
    .select({ articleCount: count() })
    .from(articles)
    .where(eq(articles.categoryId, id));

  if (articleCount > 0 && !reassignTo) {
    return {
      ok: false,
      articleCount,
      error: `This category has ${articleCount} article${articleCount === 1 ? "" : "s"}. Move them to another category first.`,
    };
  }

  let target: typeof category | undefined;
  if (articleCount > 0 && reassignTo) {
    if (reassignTo === id) return { ok: false, error: "Choose a different category to move the articles to." };
    target = await db.query.categories.findFirst({ where: eq(categories.id, reassignTo) });
    if (!target) return { ok: false, error: "The category to move articles to was not found." };
  }

  await db.transaction(async (tx) => {
    if (target) {
      await tx
        .update(articles)
        .set({ categoryId: target.id, updatedAt: new Date() })
        .where(eq(articles.categoryId, id));
    }
    await tx.delete(categories).where(eq(categories.id, id));
  });

  revalidateCategories([category.slug, ...(target ? [target.slug] : [])]);
  return { ok: true, moved: target ? articleCount : 0 };
}
