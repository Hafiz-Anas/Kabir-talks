import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { articles, bookmarks, categories } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { LISTING_PAGE_SIZE } from "@/lib/articles/public";

import { availableIn, isPublished, selectCards, toCards } from "./public/articles";

/**
 * Bookmark reads and writes. Every function takes the signed-in reader's id
 * (session.user.id) and only touches that reader's rows. Never cached.
 *
 * Bookmarks of articles that are later unpublished (or lose the locale) are
 * kept but hidden: every read joins on PUBLISHED + available in the locale.
 */

export const BOOKMARK_STATE_MAX_IDS = 60;
export const BOOKMARKS_PAGE_SIZE = LISTING_PAGE_SIZE;

/** Which of `articleIds` this reader has saved (one query for a whole page of cards). */
export async function savedAmong(userId: string, articleIds: string[]) {
  if (!articleIds.length) return [];
  const rows = await db
    .select({ articleId: bookmarks.articleId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.articleId, articleIds)));
  return rows.map((row) => row.articleId);
}

/** Saves or removes. Saving needs a published article; removing always works. Returns false if the article can't be saved. */
export async function setBookmark(userId: string, articleId: string, saved: boolean) {
  if (!saved) {
    await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.articleId, articleId)));
    return true;
  }
  const [article] = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.id, articleId), isPublished));
  if (!article) return false;
  await db.insert(bookmarks).values({ userId, articleId }).onConflictDoNothing();
  return true;
}

/** "My bookmarks": newest saved first, only articles still published and available in `locale`. */
export async function listBookmarks(userId: string, locale: Locale, page: number) {
  const where = and(eq(bookmarks.userId, userId), isPublished, availableIn(locale));
  // Sequential, not Promise.all: PGlite's socket server (local dev/tests) interleaves concurrent
  // extended-protocol messages on one pool; a bookmarks page is small, so the extra round trip is cheap.
  const rows = await selectCards()
    .innerJoin(bookmarks, eq(bookmarks.articleId, articles.id))
    .where(where)
    .orderBy(desc(bookmarks.createdAt), desc(articles.id))
    .limit(BOOKMARKS_PAGE_SIZE)
    .offset((page - 1) * BOOKMARKS_PAGE_SIZE);
  const [{ total }] = await db
    .select({ total: count() })
    .from(bookmarks)
    .innerJoin(articles, eq(articles.id, bookmarks.articleId))
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(where);
  return { items: toCards(rows, locale), total, pages: Math.max(1, Math.ceil(total / BOOKMARKS_PAGE_SIZE)) };
}
