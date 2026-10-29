import { z } from "zod";

/**
 * Phase 7C breaking-news bar: the admin input schema (shared by the form and
 * the server action) and the shape the public endpoint returns. Pure.
 */

export const BREAKING_TEXT_MAX = 200;
/** Default auto-expiry offered by the admin form. */
export const BREAKING_DEFAULT_HOURS = 6;
/** Longest allowed expiry, so a forgotten item can't sit there for ever. */
export const BREAKING_MAX_DAYS = 30;
/** localStorage key holding the ids a reader dismissed. */
export const BREAKING_DISMISSED_KEY = "kt-breaking-dismissed";

/** An https URL with a real host and no credentials. Returns the normalized URL or null. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
  return url.toString();
}

const text = z
  .string()
  .max(BREAKING_TEXT_MAX * 2)
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .refine((value) => value.length <= BREAKING_TEXT_MAX, `Must be ${BREAKING_TEXT_MAX} characters or fewer`)
  .transform((value) => value || null);

export const breakingInputSchema = z
  .object({
    id: z.uuid().optional(),
    textEn: text,
    textUr: text,
    link: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }),
      z.object({ kind: z.literal("article"), articleId: z.uuid("Choose an article") }),
      z.object({
        kind: z.literal("url"),
        url: z.string().refine((value) => safeHttpsUrl(value) !== null, "Enter a full https:// link"),
      }),
    ]),
    isActive: z.boolean(),
    /** ISO date-time, or null for no expiry. */
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((value) => value.textEn || value.textUr, { message: "Write the text in English, Urdu or both", path: ["textEn"] });

export type BreakingInput = z.input<typeof breakingInputSchema>;

/** One item as the public bar receives it: already in the reader's language. */
export type PublicBreakingItem = { id: string; text: string; href: string | null };
