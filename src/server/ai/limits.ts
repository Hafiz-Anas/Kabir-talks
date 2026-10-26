import "server-only";

import { and, eq, like, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { AI_FEATURES, type AiFeature, aiUsage, rateLimit } from "@/db/schema";
import { AI_DAILY_LIMIT, READER_ASK_PER_DAY } from "@/lib/ai/config";
import { aiDay, secondsUntilReset } from "@/lib/ai/day";

import { takeRateLimit } from "../rate-limit";

/**
 * Database-backed AI cost guards (Phase 6). They replace the Phase 3
 * in-memory limiter: every serverless instance shares the same rows.
 *
 *  - Global daily cap: AI_DAILY_LIMIT model calls per day, all features
 *    together (admin AI included), counted per feature in ai_usage.
 *  - Per-minute burst limit per admin / reader / IP (rate_limit table).
 *  - Per-reader daily limit for "Ask this article" (rate_limit table, one key
 *    per reader per day).
 *
 * Days are Pakistan dates (src/lib/ai/day.ts), so limits reset at midnight
 * for the site's readers.
 */

/**
 * Reserves one model call against today's global cap. Returns false (and
 * counts nothing) once the cap is reached. A transaction-scoped advisory
 * lock serialises reservations for the day, so concurrent requests on any
 * number of instances can never overshoot the cap.
 */
export async function reserveDailyCall(feature: AiFeature): Promise<boolean> {
  const day = aiDay();
  const { allowed, first } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`kabir-talks:ai_usage:${day}`}))`);
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${aiUsage.count}), 0)::int` })
      .from(aiUsage)
      .where(eq(aiUsage.day, day));
    if ((row?.total ?? 0) >= AI_DAILY_LIMIT) return { allowed: false, first: false };
    const [updated] = await tx
      .insert(aiUsage)
      .values({ day, feature, count: 1 })
      .onConflictDoUpdate({ target: [aiUsage.day, aiUsage.feature], set: { count: sql`${aiUsage.count} + 1` } })
      .returning({ count: aiUsage.count });
    return { allowed: true, first: updated?.count === 1 };
  });
  // First call of the day for this feature: tidy up per-reader keys from earlier days.
  if (first) await pruneOldKeys().catch(() => undefined);
  return allowed;
}

async function pruneOldKeys() {
  await db.delete(rateLimit).where(and(like(rateLimit.key, "ai:%"), lt(rateLimit.lastRequest, Date.now() - 2 * 86_400_000)));
}

/** Per-minute burst limit for one admin, reader or IP. */
export function takeMinuteLimit(id: string, max: number) {
  return takeRateLimit(`ai:min:${id}`, max, 60);
}

/** One "Ask this article" question for a reader today. */
export async function takeReaderAsk(userId: string) {
  const { allowed } = await takeRateLimit(`ai:ask:${userId}:${aiDay()}`, READER_ASK_PER_DAY, 2 * 86_400);
  return allowed;
}

export type AiUsageToday = {
  day: string;
  cap: number;
  total: number;
  byFeature: Record<AiFeature, number>;
  readerAskPerDay: number;
  resetsInSeconds: number;
};

/** Today's counts for the admin dashboard. */
export async function getAiUsageToday(): Promise<AiUsageToday> {
  const day = aiDay();
  const rows = await db.select({ feature: aiUsage.feature, count: aiUsage.count }).from(aiUsage).where(eq(aiUsage.day, day));
  const byFeature = Object.fromEntries(AI_FEATURES.map((feature) => [feature, 0])) as Record<AiFeature, number>;
  for (const row of rows) if (row.feature in byFeature) byFeature[row.feature] = row.count;
  return {
    day,
    cap: AI_DAILY_LIMIT,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    byFeature,
    readerAskPerDay: READER_ASK_PER_DAY,
    resetsInSeconds: secondsUntilReset(),
  };
}
