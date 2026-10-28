import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gt, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import type { SubscribeInput } from "@/lib/newsletter";
import { sendEmail } from "@/server/email";
import { takeRateLimit } from "@/server/rate-limit";

import { confirmationEmail } from "./emails";
import { hashToken, newConfirmToken, TOKEN_PATTERN, unsubscribeToken } from "./tokens";

/**
 * Subscribe → confirm → unsubscribe. The answers never reveal whether an
 * address is already on the list: subscribe always says "check your inbox".
 *
 * Limits: 5 sign-ups per IP per 10 minutes, and 3 confirmation emails per
 * address per day (so the form can't be used to flood someone's inbox).
 */

export type SubscribeOutcome = "sent" | "ignored" | "rate_limited";

export async function subscribe(input: SubscribeInput, ip: string): Promise<SubscribeOutcome> {
  // Bots fill every field; people never see this one. Pretend it worked.
  if (input.website?.trim()) return "ignored";

  const perIp = await takeRateLimit(`newsletter:ip:${ip}`, 5, 600);
  if (!perIp.allowed) return "rate_limited";

  const id = randomUUID();
  const confirm = newConfirmToken();
  const [row] = await db
    .insert(newsletterSubscribers)
    .values({
      id,
      email: input.email,
      locale: input.locale,
      language: input.language,
      status: "PENDING",
      confirmTokenHash: confirm.hash,
      confirmExpiresAt: confirm.expiresAt,
      unsubscribeTokenHash: unsubscribeToken(id).hash,
    })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: {
        locale: input.locale,
        language: input.language,
        status: "PENDING",
        confirmTokenHash: confirm.hash,
        confirmExpiresAt: confirm.expiresAt,
        unsubscribedAt: null,
      },
      // An active subscriber stays as they are (and gets no email).
      setWhere: ne(newsletterSubscribers.status, "ACTIVE"),
    })
    .returning({ id: newsletterSubscribers.id });
  if (!row) return "ignored";

  // Per address: checked after the write so the answer doesn't depend on whether the address exists.
  const perEmail = await takeRateLimit(`newsletter:email:${input.email}`, 3, 86_400);
  if (!perEmail.allowed) return "ignored";

  const result = await sendEmail(confirmationEmail({ email: input.email, locale: input.locale }, confirm.token));
  return result.ok ? "sent" : "ignored";
}

/** Confirms a pending subscription. Opening the link twice is fine. */
export async function confirmSubscription(token: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const hash = hashToken("confirm", token);
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: "ACTIVE", confirmedAt: sql`coalesce(${newsletterSubscribers.confirmedAt}, now())` })
    .where(
      and(
        eq(newsletterSubscribers.confirmTokenHash, hash),
        or(
          and(eq(newsletterSubscribers.status, "PENDING"), gt(newsletterSubscribers.confirmExpiresAt, sql`now()`)),
          eq(newsletterSubscribers.status, "ACTIVE"),
        ),
      ),
    )
    .returning({ id: newsletterSubscribers.id });
  return Boolean(row);
}

/** Unsubscribes. Works for any status and is safe to repeat. */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const [row] = await db
    .update(newsletterSubscribers)
    .set({
      status: "UNSUBSCRIBED",
      unsubscribedAt: sql`coalesce(${newsletterSubscribers.unsubscribedAt}, now())`,
      confirmTokenHash: null,
      confirmExpiresAt: null,
    })
    .where(eq(newsletterSubscribers.unsubscribeTokenHash, hashToken("unsubscribe", token)))
    .returning({ id: newsletterSubscribers.id });
  return Boolean(row);
}
