import "server-only";

import { getDictionary, isLocale, type Locale } from "@/i18n";
import { type EmailContent, renderEmail } from "@/lib/email/template";
import { env } from "@/lib/env";

import { type OutgoingEmail, sendEmail } from "./send";

/**
 * Email entry point (Phase 7). Delivery and drivers: ./send.ts. Layout:
 * src/lib/email/template.ts. Account emails (sign-up verification and
 * password reset) are called by Better Auth (src/lib/auth.ts) only when
 * features.authEmailEnabled is on: a real provider, or EMAIL_TEST_MODE.
 */

export { type OutgoingEmail, sendEmail, type SendResult } from "./send";

type BrandedContent = Omit<EmailContent, "siteUrl" | "siteName" | "footer" | "linkFallback" | "locale"> & {
  footer?: string;
};

/** Renders the branded layout in a locale, with the site's name, URL and standard footer. */
export function brandedEmail(locale: Locale, content: BrandedContent) {
  const dict = getDictionary(locale);
  return renderEmail({
    ...content,
    locale,
    siteUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/${locale}`,
    siteName: dict.site.name,
    footer: content.footer ?? dict.email.footerAccount,
    linkFallback: dict.email.linkFallback,
  });
}

type Recipient = { email: string; name: string; preferredLocale?: unknown };

function localeOf(user: Recipient): Locale {
  return typeof user.preferredLocale === "string" && isLocale(user.preferredLocale) ? user.preferredLocale : "en";
}

function accountEmail(user: Recipient, kind: "verify" | "reset", url: string): OutgoingEmail {
  const locale = localeOf(user);
  const dict = getDictionary(locale).email;
  const copy = dict[kind];
  const { html, text } = brandedEmail(locale, {
    preheader: copy.body,
    heading: copy.subject,
    paragraphs: [dict.greeting.replace("{name}", user.name), copy.body],
    button: { label: copy.button, url },
    note: copy.ignore,
  });
  return { to: user.email, subject: copy.subject, html, text, kind, locale };
}

/** Throws when delivery fails, so Better Auth reports an error instead of "check your inbox". */
async function sendOrThrow(message: OutgoingEmail) {
  const result = await sendEmail(message);
  if (!result.ok) throw new Error("Email delivery failed.");
}

export function sendVerificationEmail(user: Recipient, url: string) {
  return sendOrThrow(accountEmail(user, "verify", url));
}

export function sendPasswordResetEmail(user: Recipient, url: string) {
  return sendOrThrow(accountEmail(user, "reset", url));
}
