import "server-only";

import { getDictionary, isLocale, type Locale } from "@/i18n";

/**
 * Account emails: sign-up verification and password reset.
 *
 * Everything except delivery is done: Better Auth calls the two senders
 * below (src/lib/auth.ts) only when `features.authEmailEnabled` is on, and
 * the messages are written in the reader's preferred language.
 *
 * PHASE 7 — to switch these emails on:
 *  1. Implement `sendEmail` with the Resend API (RESEND_API_KEY, plus a
 *     verified "from" address).
 *  2. Set EMAIL_SENDER_CONNECTED = true in src/lib/features.ts.
 * Sign-up then requires a verified email and "Forgot password?" goes live.
 */

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  // Never log the message itself: it contains a one-time link.
  void message;
  throw new Error("Email delivery is not connected yet (Phase 7).");
}

type Recipient = { email: string; name: string; preferredLocale?: unknown };

function localeOf(user: Recipient): Locale {
  return typeof user.preferredLocale === "string" && isLocale(user.preferredLocale) ? user.preferredLocale : "en";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function build(user: Recipient, kind: "verify" | "reset", url: string): OutgoingEmail {
  const locale = localeOf(user);
  const copy = getDictionary(locale).email[kind];
  const greeting = getDictionary(locale).email.greeting.replace("{name}", user.name);
  const dir = locale === "ur" ? "rtl" : "ltr";
  return {
    to: user.email,
    subject: copy.subject,
    text: `${greeting}\n\n${copy.body}\n\n${url}\n\n${copy.ignore}`,
    html: `<div dir="${dir}" lang="${locale}"><p>${escapeHtml(greeting)}</p><p>${escapeHtml(copy.body)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(copy.button)}</a></p><p>${escapeHtml(copy.ignore)}</p></div>`,
  };
}

export function sendVerificationEmail(user: Recipient, url: string) {
  return sendEmail(build(user, "verify", url));
}

export function sendPasswordResetEmail(user: Recipient, url: string) {
  return sendEmail(build(user, "reset", url));
}
