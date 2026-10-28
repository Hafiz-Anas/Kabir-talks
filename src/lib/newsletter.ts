import { z } from "zod";

/** Newsletter input rules, shared by the sign-up box (browser) and /api/newsletter/* (server). */

export const NEWSLETTER_LANGUAGE_OPTIONS = ["en", "ur", "both"] as const;
export type NewsletterLanguage = (typeof NEWSLETTER_LANGUAGE_OPTIONS)[number];

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  language: z.enum(NEWSLETTER_LANGUAGE_OPTIONS),
  /** Language of the page, used for the emails' wording. */
  locale: z.enum(["en", "ur"]),
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(500).optional(),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const tokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export type NewsletterApiError = "invalid_email" | "rate_limited" | "invalid_token" | "unavailable" | "error";
