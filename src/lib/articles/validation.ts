import { z } from "zod";

import { LIMITS } from "./rules";
import { SLUG_HELP, SLUG_PATTERN } from "./slug";

/** Trimmed optional text: "" and whitespace become null. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2) // generous pre-trim bound; exact limit checked after trim
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, `Must be ${max} characters or fewer`)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .default(null);

export const tagInputSchema = z.union([
  z.object({ id: z.uuid() }),
  z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.tagName)
      .refine((value) => /[A-Za-z0-9]/.test(value), "New tags need an English (Latin-letter) name"),
  }),
]);

export const articlePayloadSchema = z.object({
  id: z.uuid().optional(),
  titleEn: optionalText(LIMITS.title),
  titleUr: optionalText(LIMITS.title),
  excerptEn: optionalText(LIMITS.excerpt),
  excerptUr: optionalText(LIMITS.excerpt),
  // Bodies are validated structurally by sanitizeDoc on the server.
  bodyEn: z.unknown().nullable().default(null),
  bodyUr: z.unknown().nullable().default(null),
  categoryId: z.uuid("Choose a category"),
  slug: z
    .string()
    .trim()
    .max(LIMITS.title)
    .refine((value) => value === "" || SLUG_PATTERN.test(value), SLUG_HELP),
  tags: z.array(tagInputSchema).max(LIMITS.tags).default([]),
  coverImageUrl: optionalText(1000),
  coverImageAlt: optionalText(LIMITS.alt),
  isFeatured: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
  seoTitleEn: optionalText(LIMITS.seoTitle),
  seoTitleUr: optionalText(LIMITS.seoTitle),
  seoDescriptionEn: optionalText(LIMITS.seoDescription),
  seoDescriptionUr: optionalText(LIMITS.seoDescription),
  /** Set after the admin confirms changing the slug of a published article. */
  confirmSlugChange: z.boolean().default(false),
  /** AI content in the article that the admin hasn't ticked as reviewed yet (blocks publishing). */
  aiReviewPending: z.boolean().default(false),
});

export type ArticlePayload = z.input<typeof articlePayloadSchema>;
export type ParsedArticlePayload = z.output<typeof articlePayloadSchema>;

export type FieldErrors = Partial<Record<keyof ArticlePayload | "form", string>>;

/** Flattens Zod issues to one message per top-level field. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] ?? "form") as keyof FieldErrors;
    out[key] ??= issue.message;
  }
  return out;
}
