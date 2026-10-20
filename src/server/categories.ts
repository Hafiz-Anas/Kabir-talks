import "server-only";

import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

/** ADMIN category reads (with article counts). Mutations: ./category-actions.ts */
export async function listCategoriesAdmin() {
  await requireAdmin();
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameEn: categories.nameEn,
      nameUr: categories.nameUr,
      descriptionEn: categories.descriptionEn,
      descriptionUr: categories.descriptionUr,
      sortOrder: categories.sortOrder,
      articleCount: count(articles.id),
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.nameEn));
}

export type AdminCategoryRow = Awaited<ReturnType<typeof listCategoriesAdmin>>[number];
