import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { features } from "@/lib/features";
import { processNewsletterQueue } from "@/server/newsletter/process";
import { queueDigest } from "@/server/newsletter/sends";

/**
 * For a cron job on the server (Phase 7B, VPS):
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $NEWSLETTER_CRON_SECRET" \
 *     https://example.com/api/cron/newsletter            # send the next batch
 *   ... /api/cron/newsletter?task=digest                  # queue this week's digest (once per week)
 *
 * Off (404) until NEWSLETTER_CRON_SECRET is set. `npm run newsletter:process`
 * does the same work without HTTP.
 */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: Request) {
  const secret = env.NEWSLETTER_CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!env.NEWSLETTER_CRON_SECRET) return new Response("Not found", { status: 404, headers: NO_STORE });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const task = new URL(request.url).searchParams.get("task") ?? "process";
  if (task === "digest") {
    if (!features.newsletterEnabled) return Response.json({ error: "email_not_configured" }, { status: 503, headers: NO_STORE });
    const result = await queueDigest(null);
    return Response.json(result, { headers: NO_STORE });
  }
  if (task !== "process") return Response.json({ error: "unknown_task" }, { status: 400, headers: NO_STORE });
  const summary = await processNewsletterQueue({ maxEmails: 200, timeBudgetMs: 50_000 });
  return Response.json({ ok: true, ...summary }, { headers: NO_STORE });
}
