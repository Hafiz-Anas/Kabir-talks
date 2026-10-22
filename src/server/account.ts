import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { account, articles, categories, comments, user } from "@/db/schema";
import { isLocale, type Locale } from "@/i18n/config";
import { articlePath } from "@/lib/urls";

import { availableIn, isPublished } from "./public/articles";

/**
 * Reads for the signed-in reader's own account page. Callers pass
 * session.user.id: never a user id from the request. Not cached.
 */

export const MY_COMMENTS_LIMIT = 50;

export async function getAccountOverview(userId: string, locale: Locale) {
  const [profile] = await db
    .select({ name: user.name, email: user.email, image: user.image, role: user.role, preferredLocale: user.preferredLocale })
    .from(user)
    .where(eq(user.id, userId));
  if (!profile) return null;

  const providers = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId));

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      isReply: comments.parentId,
      slug: articles.slug,
      categorySlug: categories.slug,
      titleEn: articles.titleEn,
      titleUr: articles.titleUr,
      live: sql<boolean>`${isPublished}`,
      en: availableIn("en"),
      ur: availableIn("ur"),
    })
    .from(comments)
    .innerJoin(articles, eq(articles.id, comments.articleId))
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(eq(comments.userId, userId))
    .orderBy(desc(comments.createdAt))
    .limit(MY_COMMENTS_LIMIT);

  const other: Locale = locale === "en" ? "ur" : "en";
  const myComments = rows.map((row) => {
    // Link to the reader's language if the article is available in it, else the other one; none if unpublished.
    const target = !row.live ? null : row[locale] ? locale : row[other] ? other : null;
    const title = (target ?? locale) === "ur" ? (row.titleUr ?? row.titleEn) : (row.titleEn ?? row.titleUr);
    return {
      id: row.id,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      isReply: Boolean(row.isReply),
      article: target
        ? { title: title ?? "", href: `${articlePath(target, row.categorySlug, row.slug)}#comments`, locale: target }
        : null,
    };
  });

  return {
    profile: { ...profile, preferredLocale: isLocale(profile.preferredLocale ?? undefined) ? profile.preferredLocale : null },
    hasPassword: providers.some((p) => p.providerId === "credential"),
    hasGoogle: providers.some((p) => p.providerId === "google"),
    comments: myComments,
  };
}

export type AccountOverview = NonNullable<Awaited<ReturnType<typeof getAccountOverview>>>;
