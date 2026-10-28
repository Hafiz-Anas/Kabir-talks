"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { features } from "@/lib/features";

import { processNewsletterQueue, type ProcessSummary } from "./newsletter/process";
import { queueArticleSend, queueDigest } from "./newsletter/sends";

/** Newsletter admin actions. Every action calls requireAdmin() and validates with Zod. */

const idSchema = z.uuid();

export type NewsletterActionResult = { ok: true; message: string } | { ok: false; error: string };

const NOT_CONFIGURED = "Email sending isn’t set up yet (RESEND_API_KEY and EMAIL_FROM), so newsletters can’t be sent.";

export async function removeSubscriber(id: string): Promise<NewsletterActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Subscriber not found." };
  const [row] = await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, parsed.data)).returning({ email: newsletterSubscribers.email });
  if (!row) return { ok: false, error: "Subscriber not found." };
  revalidatePath("/admin/newsletter");
  return { ok: true, message: `Removed ${row.email}.` };
}

/**
 * Queues one article for every matching subscriber. The unique dedupe key
 * makes this a no-op the second time, whoever clicks.
 */
export async function sendArticleToSubscribers(articleId: string): Promise<NewsletterActionResult> {
  const session = await requireAdmin();
  if (!features.newsletterEnabled) return { ok: false, error: NOT_CONFIGURED };
  const parsed = idSchema.safeParse(articleId);
  if (!parsed.success) return { ok: false, error: "Article not found." };
  const result = await queueArticleSend(parsed.data, session.user.id);
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/articles/${parsed.data}`);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_sent"
          ? "This article has already been sent to subscribers."
          : result.error === "not_found"
            ? "Only published articles can be sent."
            : result.error === "no_recipients"
              ? "No active subscribers read this article’s language yet."
              : "There’s nothing to send.",
    };
  }
  return { ok: true, message: `Queued for ${result.recipients} subscriber${result.recipients === 1 ? "" : "s"}.` };
}

export async function sendWeeklyDigest(): Promise<NewsletterActionResult> {
  const session = await requireAdmin();
  if (!features.newsletterEnabled) return { ok: false, error: NOT_CONFIGURED };
  const result = await queueDigest(session.user.id);
  revalidatePath("/admin/newsletter");
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_sent"
          ? `The digest for ${result.week} has already been sent.`
          : result.error === "no_recipients"
            ? "No active subscribers for this week’s stories yet."
            : "No stories to put in this week’s digest yet.",
    };
  }
  return { ok: true, message: `Digest ${result.week} queued for ${result.recipients} subscriber${result.recipients === 1 ? "" : "s"}.` };
}

/** Sends one small batch now, without waiting for the cron job. */
export async function processNewsletterNow(): Promise<NewsletterActionResult & { summary?: ProcessSummary }> {
  await requireAdmin();
  const summary = await processNewsletterQueue({ maxEmails: 100, timeBudgetMs: 25_000 });
  revalidatePath("/admin/newsletter");
  return {
    ok: true,
    summary,
    message: `Sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}${summary.retrying ? `, ${summary.retrying} to retry` : ""}. ${summary.remaining} waiting.`,
  };
}
