import "server-only";

import { and, count, desc, eq, gte, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";

/** Admin reads for /admin/newsletter. Callers must have passed requireAdmin(). */

export const SUBSCRIBER_PAGE_SIZE = 50;
export type SubscriberStatus = "PENDING" | "ACTIVE" | "UNSUBSCRIBED";

export async function subscriberCounts() {
  const rows = await db
    .select({ status: newsletterSubscribers.status, language: newsletterSubscribers.language, n: count() })
    .from(newsletterSubscribers)
    .groupBy(newsletterSubscribers.status, newsletterSubscribers.language);
  const total = (status: SubscriberStatus) => rows.filter((r) => r.status === status).reduce((sum, r) => sum + r.n, 0);
  const active = (language: "en" | "ur" | "both") => rows.find((r) => r.status === "ACTIVE" && r.language === language)?.n ?? 0;
  return {
    active: total("ACTIVE"),
    pending: total("PENDING"),
    unsubscribed: total("UNSUBSCRIBED"),
    byLanguage: { en: active("en"), ur: active("ur"), both: active("both") },
  };
}

/** Escapes LIKE wildcards so a search for "a_b" matches literally. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listSubscribers({ q, status, page }: { q?: string; status?: SubscriberStatus; page: number }) {
  const where = and(q ? ilike(newsletterSubscribers.email, likePattern(q)) : undefined, status ? eq(newsletterSubscribers.status, status) : undefined);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        language: newsletterSubscribers.language,
        locale: newsletterSubscribers.locale,
        status: newsletterSubscribers.status,
        createdAt: newsletterSubscribers.createdAt,
        confirmedAt: newsletterSubscribers.confirmedAt,
        unsubscribedAt: newsletterSubscribers.unsubscribedAt,
      })
      .from(newsletterSubscribers)
      .where(where)
      .orderBy(desc(newsletterSubscribers.createdAt), desc(newsletterSubscribers.id))
      .limit(SUBSCRIBER_PAGE_SIZE)
      .offset((page - 1) * SUBSCRIBER_PAGE_SIZE),
    db.select({ n: count() }).from(newsletterSubscribers).where(where),
  ]);
  return { rows, total: n, pages: Math.max(1, Math.ceil(n / SUBSCRIBER_PAGE_SIZE)) };
}

/** Everything for the CSV export (no tokens). */
export async function exportSubscribers(status?: SubscriberStatus) {
  return db
    .select({
      email: newsletterSubscribers.email,
      status: newsletterSubscribers.status,
      language: newsletterSubscribers.language,
      locale: newsletterSubscribers.locale,
      createdAt: newsletterSubscribers.createdAt,
      confirmedAt: newsletterSubscribers.confirmedAt,
      unsubscribedAt: newsletterSubscribers.unsubscribedAt,
    })
    .from(newsletterSubscribers)
    .where(status ? eq(newsletterSubscribers.status, status) : undefined)
    .orderBy(newsletterSubscribers.createdAt);
}

/** Active subscribers at the end of each of the last `days` days (dashboard growth chart). */
export async function subscriberGrowth(days = 30) {
  const rows = await db.execute<{ day: string; active: number }>(sql`
    select to_char(d.day, 'YYYY-MM-DD') as day,
           (select count(*)::int from newsletter_subscribers s
             where s.confirmed_at is not null
               and (s.confirmed_at at time zone 'Asia/Karachi')::date <= d.day
               and (s.unsubscribed_at is null or (s.unsubscribed_at at time zone 'Asia/Karachi')::date > d.day)) as active
      from generate_series((now() at time zone 'Asia/Karachi')::date - ${days - 1}::int, (now() at time zone 'Asia/Karachi')::date, interval '1 day') as d(day)
     order by d.day`);
  return [...rows].map((row) => ({ day: row.day, active: Number(row.active) }));
}

export async function newSubscribersSince(since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(newsletterSubscribers)
    .where(and(eq(newsletterSubscribers.status, "ACTIVE"), gte(newsletterSubscribers.confirmedAt, since)));
  return row.n;
}
