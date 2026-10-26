import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimit } from "@/db/schema";

/**
 * Fixed-window limiter in the rate_limit table (shared with Better Auth's
 * per-IP auth limits, which use "ip|/path" keys). One atomic upsert per call,
 * so it holds across serverless instances. `last_request` here is the start
 * of the current window.
 *
 *   await consumeRateLimit(`comment:${userId}`, 5, 600)  // 5 per 10 minutes
 *
 * Keys in use: "comment:{userId}" (Phase 5); "ai:min:{id}" and
 * "ai:ask:{userId}:{day}" (Phase 6, src/server/ai/limits.ts).
 */
export async function takeRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const expired = sql`${rateLimit.lastRequest} <= ${windowStart}`;
  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
  const allowed = (row?.count ?? 1) <= max;
  const retryAfter = allowed ? 0 : Math.max(1, Math.ceil(((row?.lastRequest ?? now) + windowSeconds * 1000 - now) / 1000));
  return { allowed, retryAfter };
}

/** Returns true if this call is allowed. */
export async function consumeRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  return (await takeRateLimit(key, max, windowSeconds)).allowed;
}
