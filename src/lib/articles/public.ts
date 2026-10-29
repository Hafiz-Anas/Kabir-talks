import type { Locale } from "@/i18n/config";

/**
 * Shapes returned by the public reads (src/server/public/*). Plain data only
 * (dates as ISO strings) so they cache cleanly and can be passed to Client
 * Components such as the homepage "Load more" button.
 */

export type ArticleCardData = {
  id: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  /** Already localized to the locale the card was requested for. */
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  isFeatured: boolean;
  publishedAt: string;
  readingMinutes: number;
  /** Phase 7C: the credited author, in the card's language. */
  author: { slug: string; name: string; nameIsEnglish: boolean; photoUrl: string | null };
};

export type TagData = { id: string; slug: string; nameEn: string; nameUr: string | null };

/** Page size for category, tag and search listings. */
export const LISTING_PAGE_SIZE = 12;

/** Cards per "Load more" step in the homepage Latest feed (also its first page). */
export const FEED_PAGE_SIZE = 6;

export function tagName(tag: Pick<TagData, "nameEn" | "nameUr">, locale: Locale) {
  return locale === "ur" && tag.nameUr ? tag.nameUr : tag.nameEn;
}

/**
 * "Updated" is only shown when an article was edited at least a day after it
 * was published — small fixes shortly after publishing don't count.
 */
export const SIGNIFICANT_UPDATE_MS = 24 * 60 * 60 * 1000;

export function significantUpdate(publishedAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(publishedAt).getTime() >= SIGNIFICANT_UPDATE_MS;
}

/**
 * Parses ?page= for paginated listings. Returns null for anything that isn't
 * a positive whole number (the page then 404s). Missing means page 1.
 */
export function parsePageParam(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (Array.isArray(value) || !/^[1-9]\d{0,4}$/.test(value)) return null;
  return Number(value);
}
