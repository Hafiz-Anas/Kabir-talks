import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsletterDeliveries, newsletterSends, newsletterSubscribers } from "@/db/schema";
import { emailDriver } from "@/lib/features";
import { sendEmail } from "@/server/email";

import { newsletterEmail } from "./emails";

/**
 * Works through queued newsletter deliveries in small batches. Run by
 * `npm run newsletter:process` (a plain script for a VPS cron job), by the
 * secret-protected POST /api/cron/newsletter, and by the admin's "Process
 * now" button. Several runs at once are safe: rows are claimed with
 * FOR UPDATE SKIP LOCKED, so no two runs take the same delivery.
 *
 * A claimed row that never finished (crash, timeout) is claimed again after
 * STALE_MINUTES, at most MAX_ATTEMPTS times. Resend gets an Idempotency-Key
 * per (send, subscriber), so a retry within 24 hours can't email anyone twice.
 */

export const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 10;
/** Resend allows a few requests per second by default; stay well under it. */
const RESEND_GAP_MS = 600;

type Claimed = { send_id: string; subscriber_id: string; attempts: number };

async function claimBatch(limit: number): Promise<Claimed[]> {
  // Rows stuck in "sending" with no attempts left are given up on first.
  await db
    .update(newsletterDeliveries)
    .set({ status: "failed", error: "Timed out", lockedAt: null })
    .where(
      and(
        eq(newsletterDeliveries.status, "sending"),
        sql`${newsletterDeliveries.lockedAt} < now() - make_interval(mins => ${STALE_MINUTES})`,
        sql`${newsletterDeliveries.attempts} >= ${MAX_ATTEMPTS}`,
      ),
    );

  const rows = await db.execute<Claimed>(sql`
    update newsletter_deliveries d
       set status = 'sending', locked_at = now(), attempts = d.attempts + 1
      from (
        select send_id, subscriber_id from newsletter_deliveries
         where status = 'pending'
            or (status = 'sending' and locked_at < now() - make_interval(mins => ${STALE_MINUTES}) and attempts < ${MAX_ATTEMPTS})
         order by send_id, subscriber_id
         limit ${limit}
         for update skip locked
      ) c
     where d.send_id = c.send_id and d.subscriber_id = c.subscriber_id
    returning d.send_id, d.subscriber_id, d.attempts`);
  return [...rows];
}

async function finish(sendId: string, subscriberId: string, values: Partial<typeof newsletterDeliveries.$inferInsert>) {
  await db
    .update(newsletterDeliveries)
    .set({ lockedAt: null, ...values })
    .where(and(eq(newsletterDeliveries.sendId, sendId), eq(newsletterDeliveries.subscriberId, subscriberId)));
}

/** Marks sends with nothing left to deliver as done. */
async function closeFinishedSends() {
  await db.execute(sql`
    update newsletter_sends s set status = 'done', finished_at = now()
     where s.status = 'queued'
       and not exists (select 1 from newsletter_deliveries d where d.send_id = s.id and d.status in ('pending', 'sending'))`);
}

export type ProcessSummary = { sent: number; failed: number; skipped: number; retrying: number; remaining: number };

export async function processNewsletterQueue({ maxEmails = 200, timeBudgetMs = 50_000 } = {}): Promise<ProcessSummary> {
  const started = Date.now();
  const summary = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
  let handled = 0;

  while (handled < maxEmails && Date.now() - started < timeBudgetMs) {
    const batch = await claimBatch(Math.min(BATCH_SIZE, maxEmails - handled));
    if (batch.length === 0) break;

    const sendIds = [...new Set(batch.map((row) => row.send_id))];
    const subscriberIds = [...new Set(batch.map((row) => row.subscriber_id))];
    const [sends, subscribers] = await Promise.all([
      db.select().from(newsletterSends).where(inArray(newsletterSends.id, sendIds)),
      db.select().from(newsletterSubscribers).where(inArray(newsletterSubscribers.id, subscriberIds)),
    ]);

    for (const row of batch) {
      handled++;
      const send = sends.find((s) => s.id === row.send_id);
      const subscriber = subscribers.find((s) => s.id === row.subscriber_id);
      // Unsubscribed (or removed) since the send was queued: never email them.
      const message = send && subscriber?.status === "ACTIVE" ? newsletterEmail(send, subscriber) : null;
      if (!message) {
        summary.skipped++;
        await finish(row.send_id, row.subscriber_id, { status: "skipped" });
        continue;
      }

      const result = await sendEmail({ ...message, idempotencyKey: `newsletter-${row.send_id}-${row.subscriber_id}` });
      if (result.ok) {
        summary.sent++;
        await finish(row.send_id, row.subscriber_id, { status: "sent", sentAt: new Date(), error: null });
      } else if (result.retryable && row.attempts < MAX_ATTEMPTS) {
        summary.retrying++;
        await finish(row.send_id, row.subscriber_id, { status: "pending", error: result.error });
      } else {
        summary.failed++;
        await finish(row.send_id, row.subscriber_id, { status: "failed", error: result.error });
      }
      if (emailDriver === "resend") await new Promise((resolve) => setTimeout(resolve, RESEND_GAP_MS));
    }
  }

  await closeFinishedSends();
  const [left] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(newsletterDeliveries)
    .where(inArray(newsletterDeliveries.status, ["pending", "sending"]));
  return { ...summary, remaining: left.n };
}
