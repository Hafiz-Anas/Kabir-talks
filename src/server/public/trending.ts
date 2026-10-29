import "server-only";

import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { articles, articleViews, authors, categories } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { aiDay } from "@/lib/ai/day";
import type { ArticleCardData } from "@/lib/articles/public";
import { cacheTags } from "@/lib/cache-tags";

import { availableIn, cardColumns, isPublished, newestFirst, toCards } from "./articles";

/**
 * Trending (Phase 7): the most-viewed published stories in a language over
 * the last 48 hours — today and yesterday, Pakistan time — or the last 7
 * days when fewer than MIN_TRENDING stories had views in that window.
 *
 * Cached for about 10 minutes (ISR): pages that show it stay static and
 * pick up new numbers in the background. Publishing or unpublishing expires
 * it immediately (cacheTags.articles).
 */

export const MIN_TRENDING = 3;
const TRENDING_LIFE = { stale: 300, revalidate: 600, expire: 86_400 };

export type TrendingCard = ArticleCardData & { views: number };

async function mostViewed(locale: Locale, sinceDay: string, limit: number, excludeIds: string[]) {
  const views = db
    .select({ articleId: articleViews.articleId, views: sql<number>`sum(${articleViews.count})`.mapWith(Number).as("views") })
    .from(articleViews)
    .where(gte(articleViews.date, sinceDay))
    .groupBy(articleViews.articleId)
    .as("window_views");

  const rows = await db
    .select({ ...cardColumns, views: views.views })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .innerJoin(authors, eq(authors.id, articles.authorProfileId))
    .innerJoin(views, eq(views.articleId, articles.id))
    .where(and(isPublished, availableIn(locale), excludeIds.length ? notInArray(articles.id, excludeIds) : undefined))
    .orderBy(desc(views.views), ...newestFirst)
    .limit(limit);
  const viewsById = new Map(rows.map((row) => [row.id, row.views]));
  return toCards(rows, locale).map((card) => ({ ...card, views: viewsById.get(card.id) ?? 0 }));
}

export async function listTrending(locale: Locale, { limit = 5, excludeId }: { limit?: number; excludeId?: string } = {}): Promise<TrendingCard[]> {
  "use cache";
  cacheLife(TRENDING_LIFE);
  cacheTag(cacheTags.articles, "trending");

  const exclude = excludeId ? [excludeId] : [];
  const now = Date.now();
  const recent = await mostViewed(locale, aiDay(now - 86_400_000), limit, exclude);
  if (recent.length >= Math.min(MIN_TRENDING, limit)) return recent;
  return mostViewed(locale, aiDay(now - 6 * 86_400_000), limit, exclude);
}
