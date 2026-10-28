import "server-only";

import { createHmac } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";
import { getSessionCookie } from "better-auth/cookies";

import { db } from "@/db";
import { articles, articleViews, articleViewVisitors } from "@/db/schema";
import { aiDay } from "@/lib/ai/day";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { takeRateLimit } from "@/server/rate-limit";

/**
 * Article view counting (Phase 7). The page stays static; a small beacon in
 * the browser posts here once the article is actually visible.
 *
 * Counted once per visitor per article per Pakistan day. The visitor is an
 * HMAC of IP + user agent keyed with a secret that changes daily, so no IP
 * is stored and nobody can be followed from one day to the next.
 *
 * Not counted: bots and headless browsers (user agent), prefetches
 * (Purpose / Sec-Purpose headers), admins, unpublished articles, and anyone
 * over 60 beacons a minute.
 */

export const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrape|fetch|preview|facebookexternalhit|embedly|whatsapp\/|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|undici|^$/i;

export type ViewOutcome = "counted" | "duplicate" | "ignored" | "rate_limited";

function dailyVisitorHash(ip: string, userAgent: string, day: string) {
  const dayKey = createHmac("sha256", env.BETTER_AUTH_SECRET).update(`views:${day}`).digest();
  return createHmac("sha256", dayKey).update(`${ip}|${userAgent}`).digest("base64url").slice(0, 22);
}

export function isPrefetch(request: Request) {
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""} ${request.headers.get("x-purpose") ?? ""}`;
  return /prefetch|preview/i.test(purpose) || request.headers.get("next-router-prefetch") !== null;
}

async function isAdmin(request: Request) {
  if (!getSessionCookie(request)) return false;
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  return session?.user.role === "admin";
}

export async function recordView(articleId: string, request: Request, ip: string): Promise<ViewOutcome> {
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? "";
  if (BOT_PATTERN.test(userAgent) || isPrefetch(request)) return "ignored";

  const limit = await takeRateLimit(`views:ip:${ip}`, 60, 60);
  if (!limit.allowed) return "rate_limited";
  if (await isAdmin(request)) return "ignored";

  const day = aiDay();
  const counted = await db.transaction(async (tx) => {
    const [published] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.status, "PUBLISHED")))
      .limit(1);
    if (!published) return null;
    const [first] = await tx
      .insert(articleViewVisitors)
      .values({ articleId, date: day, visitorHash: dailyVisitorHash(ip, userAgent, day) })
      .onConflictDoNothing()
      .returning({ articleId: articleViewVisitors.articleId });
    if (!first) return false;
    await tx
      .insert(articleViews)
      .values({ articleId, date: day, count: 1 })
      .onConflictDoUpdate({ target: [articleViews.articleId, articleViews.date], set: { count: sql`${articleViews.count} + 1` } });
    return true;
  });

  // Housekeeping: yesterday's rows are still needed around midnight; older ones never are.
  if (Math.random() < 0.01) {
    await db.delete(articleViewVisitors).where(lt(articleViewVisitors.date, aiDay(Date.now() - 2 * 86_400_000)));
  }
  return counted === null ? "ignored" : counted ? "counted" : "duplicate";
}
