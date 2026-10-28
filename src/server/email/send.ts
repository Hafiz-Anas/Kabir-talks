import "server-only";

import { lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { env } from "@/lib/env";
import { emailDriver } from "@/lib/features";

/**
 * The one way the site sends email (Phase 7). Two drivers:
 *
 *  - "log" (default, no Resend key): prints a line to the server console and
 *    stores the whole message in email_outbox, so the admin can preview it on
 *    /admin/emails. Nothing leaves the server.
 *  - "resend": RESEND_API_KEY + EMAIL_FROM are set. Sends through Resend's
 *    REST API (https://resend.com/docs/api-reference/emails/send-email) and
 *    records only metadata in email_outbox.
 *
 * sendEmail never throws for delivery problems: it returns { ok: false } so a
 * newsletter batch can retry later. The account-email wrappers throw instead.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** What sent it: "verify", "reset", "newsletter-confirm", "newsletter-article", "digest", "contact"… */
  kind: string;
  locale?: Locale;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
  /** Resend de-duplicates retries with the same key for 24 hours. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string; retryable: boolean };

const RESEND_URL = "https://api.resend.com/emails";
const OUTBOX_KEEP_DAYS = 30;

async function sendWithResend(message: OutgoingEmail): Promise<SendResult> {
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id ?? null };
    }
    const body = (await response.json().catch(() => ({}))) as { message?: string; name?: string };
    // 429 (rate limit) and 5xx are worth retrying; 4xx validation errors are not.
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, error: `Resend ${response.status}: ${body.message ?? body.name ?? "error"}`.slice(0, 300), retryable };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "network error", retryable: true };
  }
}

function logToConsole(message: OutgoingEmail) {
  console.info(`[email:log] ${message.kind} → ${message.to}: ${message.subject}`);
  // The text can hold one-time links; only print it on a development machine.
  if (env.NODE_ENV !== "production") console.info(message.text.replace(/^/gm, "  │ "));
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  const result: SendResult = emailDriver === "resend" ? await sendWithResend(message) : (logToConsole(message), { ok: true, id: null });

  try {
    await db.insert(emailOutbox).values({
      to: message.to,
      subject: message.subject,
      kind: message.kind,
      locale: message.locale ?? "en",
      provider: emailDriver,
      status: result.ok ? "sent" : "failed",
      html: emailDriver === "log" ? message.html : null,
      text: emailDriver === "log" ? message.text : null,
      providerId: result.ok ? result.id : null,
      error: result.ok ? null : result.error,
    });
    // Cheap housekeeping: roughly one send in fifty prunes old rows.
    if (Math.random() < 0.02) {
      await db.delete(emailOutbox).where(lt(emailOutbox.createdAt, sql`now() - make_interval(days => ${OUTBOX_KEEP_DAYS})`));
    }
  } catch (error) {
    // The outbox is a record, not the delivery: never fail a sent email because of it.
    console.error("[email] outbox write failed", error instanceof Error ? error.message : error);
  }

  if (!result.ok) console.error(`[email] ${message.kind} → ${message.to} failed: ${result.error}`);
  return result;
}
