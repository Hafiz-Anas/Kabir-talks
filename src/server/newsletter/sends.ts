import "server-only";

import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  articles,
  articleViews,
  newsletterDeliveries,
  type NewsletterPayload,
  newsletterSends,
  newsletterSubscribers,
} from "@/db/schema";
import { getDictionary, locales } from "@/i18n";
import { aiDay } from "@/lib/ai/day";
import { env } from "@/lib/env";
import { articlePath, absoluteUrl } from "@/lib/urls";
import { availableIn, isPublished, newestFirst, selectCards, toCards } from "@/server/public/articles";

import { eligibleLanguages } from "./emails";

/**
 * Queueing newsletters. Nothing is sent here: a send and one delivery row
 * per eligible ACTIVE subscriber are written in one transaction, and the
 * processor (./process.ts) works through them in small batches.
 *
 * "Never twice": newsletter_sends.dedupe_key is unique — "article:{id}" for
 * an article, "digest:{ISO week}" for the weekly digest — so a second click,
 * a second admin or a retrying cron job can't queue the same thing again.
 */

export const DIGEST_SIZE = 5;

const url = (path: string) => absoluteUrl(env.NEXT_PUBLIC_SITE_URL, path);

/** ISO week of the Pakistan date, e.g. "2026-W44". */
export function digestWeek(now = Date.now()) {
  const date = new Date(`${aiDay(now)}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type QueueResult =
  | { ok: true; sendId: string; recipients: number }
  | { ok: false; error: "already_sent" | "not_found" | "empty" | "no_recipients" };

/** Rolls the transaction back when nobody would get the email, so it can still be sent later. */
class NoRecipients extends Error {}

async function queue(input: { kind: "article" | "digest"; dedupeKey: string; articleId?: string; payload: NewsletterPayload; createdBy: string | null }): Promise<QueueResult> {
  const languages = eligibleLanguages(input.payload);
  if (languages.length === 0) return { ok: false, error: "empty" };

  return db.transaction(async (tx) => {
    const [send] = await tx
      .insert(newsletterSends)
      .values({ kind: input.kind, dedupeKey: input.dedupeKey, articleId: input.articleId ?? null, payload: input.payload, createdBy: input.createdBy })
      .onConflictDoNothing({ target: newsletterSends.dedupeKey })
      .returning({ id: newsletterSends.id });
    if (!send) return { ok: false, error: "already_sent" } as const;

    const inserted = await tx
      .insert(newsletterDeliveries)
      .select(
        tx
          .select({
            sendId: sql<string>`${send.id}::uuid`.as("send_id"),
            subscriberId: newsletterSubscribers.id,
            status: sql<"pending">`'pending'::newsletter_delivery_status`.as("status"),
            attempts: sql<number>`0`.as("attempts"),
            lockedAt: sql<null>`null::timestamptz`.as("locked_at"),
            sentAt: sql<null>`null::timestamptz`.as("sent_at"),
            error: sql<null>`null::text`.as("error"),
          })
          .from(newsletterSubscribers)
          .where(and(eq(newsletterSubscribers.status, "ACTIVE"), inArray(newsletterSubscribers.language, languages))),
      )
      .returning({ subscriberId: newsletterDeliveries.subscriberId });
    if (inserted.length === 0) throw new NoRecipients();

    await tx.update(newsletterSends).set({ recipients: inserted.length }).where(eq(newsletterSends.id, send.id));
    return { ok: true, sendId: send.id, recipients: inserted.length } as const;
  }).catch((error: unknown) => {
    if (error instanceof NoRecipients) return { ok: false, error: "no_recipients" } as const;
    throw error;
  });
}

/** The frozen content of an article send: one block per language the article is published in. */
export async function articlePayload(articleId: string): Promise<NewsletterPayload | null> {
  const rows = await selectCards().where(and(isPublished, eq(articles.id, articleId))).limit(1);
  if (rows.length === 0) return null;
  const payload: NewsletterPayload = {};
  for (const locale of locales) {
    const [card] = toCards(rows, locale);
    if (!card) continue;
    payload[locale] = {
      subject: card.title,
      heading: card.title,
      intro: card.excerpt ?? "",
      items: [{ title: card.title, url: url(articlePath(locale, card.categorySlug, card.slug)), excerpt: card.excerpt, meta: card.categoryName }],
    };
  }
  return payload;
}

export async function queueArticleSend(articleId: string, createdBy: string): Promise<QueueResult> {
  const payload = await articlePayload(articleId);
  if (!payload) return { ok: false, error: "not_found" };
  return queue({ kind: "article", dedupeKey: `article:${articleId}`, articleId, payload, createdBy });
}

/**
 * This week's digest: per language, the most-read published stories of the
 * last 7 days (views from article_views), then the newest of the week to
 * fill up. Stories older than a week only count if people read them this week.
 */
export async function digestPayload(now = Date.now()): Promise<NewsletterPayload> {
  const since = aiDay(now - 6 * 86_400_000);
  const weekViews = db
    .select({ articleId: articleViews.articleId, views: sql<number>`sum(${articleViews.count})`.as("views") })
    .from(articleViews)
    .where(gte(articleViews.date, since))
    .groupBy(articleViews.articleId)
    .as("week_views");

  const payload: NewsletterPayload = {};
  for (const locale of locales) {
    const rows = await selectCards()
      .leftJoin(weekViews, eq(weekViews.articleId, articles.id))
      .where(
        and(
          isPublished,
          availableIn(locale),
          or(sql`${weekViews.views} > 0`, gte(articles.publishedAt, new Date(now - 7 * 86_400_000))),
        ),
      )
      .orderBy(sql`coalesce(${weekViews.views}, 0) desc`, ...newestFirst)
      .limit(DIGEST_SIZE);
    const cards = toCards(rows, locale);
    if (cards.length === 0) continue;
    const copy = getDictionary(locale).newsletter.email;
    payload[locale] = {
      subject: copy.digestSubject,
      heading: copy.digestHeading,
      intro: copy.digestIntro,
      items: cards.map((card) => ({
        title: card.title,
        url: url(articlePath(locale, card.categorySlug, card.slug)),
        excerpt: card.excerpt,
        meta: card.categoryName,
      })),
    };
  }
  return payload;
}

export async function queueDigest(createdBy: string | null, now = Date.now()): Promise<QueueResult & { week: string }> {
  const week = digestWeek(now);
  const result = await queue({ kind: "digest", dedupeKey: `digest:${week}`, payload: await digestPayload(now), createdBy });
  return { ...result, week };
}

/** Editor card: was this article sent, and how many subscribers would get it. */
export async function articleSendStatus(articleId: string) {
  const [send] = await db
    .select({ id: newsletterSends.id, createdAt: newsletterSends.createdAt, recipients: newsletterSends.recipients, status: newsletterSends.status })
    .from(newsletterSends)
    .where(eq(newsletterSends.dedupeKey, `article:${articleId}`))
    .limit(1);
  if (send) {
    const [delivered] = await db
      .select({ n: count() })
      .from(newsletterDeliveries)
      .where(and(eq(newsletterDeliveries.sendId, send.id), eq(newsletterDeliveries.status, "sent")));
    return { sent: { at: send.createdAt.toISOString(), recipients: send.recipients, delivered: delivered.n, done: send.status === "done" }, eligible: 0 };
  }
  const payload = await articlePayload(articleId);
  const languages = payload ? eligibleLanguages(payload) : [];
  if (languages.length === 0) return { sent: null, eligible: 0 };
  const [row] = await db
    .select({ n: count() })
    .from(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.status, "ACTIVE"), inArray(newsletterSubscribers.language, languages)));
  return { sent: null, eligible: row.n };
}

/** Admin list of sends with delivery progress. */
export async function listSends(limit = 20) {
  const progress = db
    .select({
      sendId: newsletterDeliveries.sendId,
      sent: sql<number>`count(*) filter (where ${newsletterDeliveries.status} = 'sent')`.mapWith(Number).as("sent"),
      failed: sql<number>`count(*) filter (where ${newsletterDeliveries.status} = 'failed')`.mapWith(Number).as("failed"),
      skipped: sql<number>`count(*) filter (where ${newsletterDeliveries.status} = 'skipped')`.mapWith(Number).as("skipped"),
      waiting: sql<number>`count(*) filter (where ${newsletterDeliveries.status} in ('pending', 'sending'))`.mapWith(Number).as("waiting"),
    })
    .from(newsletterDeliveries)
    .groupBy(newsletterDeliveries.sendId)
    .as("progress");

  return db
    .select({
      id: newsletterSends.id,
      kind: newsletterSends.kind,
      dedupeKey: newsletterSends.dedupeKey,
      payload: newsletterSends.payload,
      status: newsletterSends.status,
      recipients: newsletterSends.recipients,
      createdAt: newsletterSends.createdAt,
      finishedAt: newsletterSends.finishedAt,
      sent: progress.sent,
      failed: progress.failed,
      skipped: progress.skipped,
      waiting: progress.waiting,
    })
    .from(newsletterSends)
    .leftJoin(progress, eq(progress.sendId, newsletterSends.id))
    .orderBy(desc(newsletterSends.createdAt))
    .limit(limit);
}

