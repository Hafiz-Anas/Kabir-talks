import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { articles, articleViews, categories } from "@/db/schema";
import { aiDay } from "@/lib/ai/day";

/**
 * Admin dashboard numbers (Phase 7), from article_views (one row per article
 * per Pakistan day). Callers must have passed requireAdmin(). Days are PKT,
 * like the counting itself.
 */

const daysAgo = (n: number) => aiDay(Date.now() - n * 86_400_000);

export async function viewTotals() {
  const [row] = await db
    .select({
      today: sql<number>`coalesce(sum(${articleViews.count}) filter (where ${articleViews.date} = ${daysAgo(0)}), 0)`.mapWith(Number),
      week: sql<number>`coalesce(sum(${articleViews.count}) filter (where ${articleViews.date} >= ${daysAgo(6)}), 0)`.mapWith(Number),
      month: sql<number>`coalesce(sum(${articleViews.count}), 0)`.mapWith(Number),
    })
    .from(articleViews)
    .where(gte(articleViews.date, daysAgo(29)));
  return row;
}

/** Views per day for the last `days` days, oldest first, with zero days filled in. */
export async function dailyViews(days = 30) {
  const rows = await db
    .select({ date: articleViews.date, views: sql<number>`sum(${articleViews.count})`.mapWith(Number) })
    .from(articleViews)
    .where(gte(articleViews.date, daysAgo(days - 1)))
    .groupBy(articleViews.date);
  const byDate = new Map(rows.map((r) => [r.date, r.views]));
  return Array.from({ length: days }, (_, i) => {
    const date = daysAgo(days - 1 - i);
    return { date, views: byDate.get(date) ?? 0 };
  });
}

export async function topArticles(days = 30, limit = 10) {
  return db
    .select({
      id: articles.id,
      titleEn: articles.titleEn,
      titleUr: articles.titleUr,
      status: articles.status,
      views: sql<number>`sum(${articleViews.count})`.mapWith(Number).as("views"),
    })
    .from(articleViews)
    .innerJoin(articles, eq(articles.id, articleViews.articleId))
    .where(gte(articleViews.date, daysAgo(days - 1)))
    .groupBy(articles.id)
    .orderBy(desc(sql`views`), desc(articles.id))
    .limit(limit);
}

export async function viewsByCategory(days = 30) {
  return db
    .select({
      id: categories.id,
      nameEn: categories.nameEn,
      views: sql<number>`coalesce(sum(${articleViews.count}), 0)`.mapWith(Number).as("views"),
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .leftJoin(articleViews, and(eq(articleViews.articleId, articles.id), gte(articleViews.date, daysAgo(days - 1))))
    .groupBy(categories.id)
    .orderBy(desc(sql`views`), categories.nameEn);
}
