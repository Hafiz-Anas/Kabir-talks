import "server-only";

import type { NewsletterPayload } from "@/db/schema";
import { getDictionary, type Locale } from "@/i18n";
import { env } from "@/lib/env";
import type { NewsletterLanguage } from "@/lib/newsletter";
import { brandedEmail, type OutgoingEmail } from "@/server/email";

import { unsubscribeToken } from "./tokens";

const site = () => env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");

export function confirmUrl(locale: Locale, token: string) {
  return `${site()}/${locale}/newsletter/confirm?token=${token}`;
}

export function unsubscribePageUrl(locale: Locale, token: string) {
  return `${site()}/${locale}/newsletter/unsubscribe?token=${token}`;
}

export function confirmationEmail(subscriber: { email: string; locale: Locale }, token: string): OutgoingEmail {
  const copy = getDictionary(subscriber.locale).newsletter.email;
  const { html, text } = brandedEmail(subscriber.locale, {
    preheader: copy.confirmBody,
    heading: copy.confirmSubject,
    paragraphs: [copy.confirmBody],
    button: { label: copy.confirmButton, url: confirmUrl(subscriber.locale, token) },
    note: copy.confirmIgnore,
    footer: copy.footer,
  });
  return { to: subscriber.email, subject: copy.confirmSubject, html, text, kind: "newsletter-confirm", locale: subscriber.locale };
}

type Recipient = { id: string; email: string; locale: Locale; language: NewsletterLanguage };
type Send = { id: string; kind: "article" | "digest"; payload: NewsletterPayload };

/**
 * Which language(s) of a send a subscriber gets, and the language of the
 * email's wording. Empty `content` = nothing for them (skip).
 *  - article: one email, in their language; "both" readers get the
 *    version in their page language when it exists, else the other one.
 *  - digest: their language; "both" readers get both lists in one email.
 */
export function pickContent(send: Send, recipient: Recipient): { content: Locale[]; ui: Locale } {
  const available = (["en", "ur"] as const).filter((l) => (send.payload[l]?.items.length ?? 0) > 0);
  const wanted = recipient.language === "both" ? available : available.filter((l) => l === recipient.language);
  if (wanted.length === 0) return { content: [], ui: recipient.locale };
  if (send.kind === "article" || wanted.length === 1) {
    const one = wanted.includes(recipient.locale) ? recipient.locale : wanted[0];
    return { content: [one], ui: one };
  }
  return { content: wanted, ui: recipient.locale };
}

/** Subscribers whose language matches at least one language in the payload (for queueing). */
export function eligibleLanguages(payload: NewsletterPayload): NewsletterLanguage[] {
  const langs: NewsletterLanguage[] = [];
  if (payload.en?.items.length) langs.push("en");
  if (payload.ur?.items.length) langs.push("ur");
  return langs.length ? [...langs, "both"] : [];
}

export function newsletterEmail(send: Send, recipient: Recipient): OutgoingEmail | null {
  const { content, ui } = pickContent(send, recipient);
  if (content.length === 0) return null;
  const copy = getDictionary(ui).newsletter.email;
  const unsub = unsubscribeToken(recipient.id).token;
  const unsubscribe = { label: copy.unsubscribe, url: unsubscribePageUrl(ui, unsub) };
  const headers = {
    // RFC 2369 + RFC 8058: mail apps show their own "Unsubscribe" button and POST here.
    "List-Unsubscribe": `<${site()}/api/newsletter/unsubscribe?token=${unsub}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  if (send.kind === "article") {
    const group = send.payload[content[0]]!;
    const story = group.items[0];
    const { html, text } = brandedEmail(ui, {
      preheader: story.excerpt ?? group.intro,
      heading: story.title,
      paragraphs: [copy.newStory + (story.meta ? ` · ${story.meta}` : ""), ...(story.excerpt ? [story.excerpt] : [])],
      button: { label: copy.readStory, url: story.url },
      footer: copy.footer,
      unsubscribe,
    });
    return { to: recipient.email, subject: group.subject, html, text, kind: "newsletter-article", locale: ui, headers };
  }

  const main = send.payload[ui] ?? send.payload[content[0]]!;
  const groups =
    content.length > 1
      ? content.map((l) => ({ title: l === "en" ? copy.digestGroupEn : copy.digestGroupUr, lang: l, items: send.payload[l]!.items }))
      : undefined;
  const { html, text } = brandedEmail(ui, {
    preheader: main.intro,
    heading: main.heading,
    paragraphs: [main.intro],
    ...(groups ? { groups } : { items: send.payload[content[0]]!.items }),
    footer: copy.footer,
    unsubscribe,
  });
  return { to: recipient.email, subject: main.subject, html, text, kind: "digest", locale: ui, headers };
}
