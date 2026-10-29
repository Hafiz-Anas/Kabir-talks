import { z } from "zod";

import type { Locale } from "@/i18n/config";

import { SLUG_HELP, SLUG_PATTERN } from "./articles/slug";
import { type SocialLinks, socialLinksInputSchema } from "./social";

/** Author profiles (Phase 7C): admin input schema and the public shape. Pure. */

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, `Must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);

export const AUTHOR_BIO_MAX = 600;

export const authorInputSchema = z.object({
  id: z.uuid().optional(),
  nameEn: z.string().trim().min(1, "English name is required").max(100),
  nameUr: optionalText(100),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((value) => value === "" || SLUG_PATTERN.test(value), SLUG_HELP),
  titleEn: optionalText(100),
  titleUr: optionalText(100),
  bioEn: optionalText(AUTHOR_BIO_MAX),
  bioUr: optionalText(AUTHOR_BIO_MAX),
  photoUrl: optionalText(1000),
  socialLinks: socialLinksInputSchema,
  isDefault: z.boolean().default(false),
});

export type AuthorInput = z.input<typeof authorInputSchema>;

/** An author as public pages use it, already in one language. */
export type PublicAuthor = {
  id: string;
  slug: string;
  name: string;
  /** True when the Urdu page shows the English name (no Urdu name set). */
  nameIsEnglish: boolean;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  socialLinks: SocialLinks;
};

type AuthorRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameUr: string | null;
  titleEn: string | null;
  titleUr: string | null;
  bioEn: string | null;
  bioUr: string | null;
  photoUrl: string | null;
  socialLinks: SocialLinks;
};

export function localizeAuthor(row: AuthorRow, locale: Locale): PublicAuthor {
  const urName = row.nameUr?.trim();
  return {
    id: row.id,
    slug: row.slug,
    name: locale === "ur" && urName ? urName : row.nameEn,
    nameIsEnglish: locale === "ur" && !urName,
    title: (locale === "en" ? row.titleEn : row.titleUr)?.trim() || null,
    bio: (locale === "en" ? row.bioEn : row.bioUr)?.trim() || null,
    photoUrl: row.photoUrl,
    socialLinks: row.socialLinks,
  };
}

export function authorPath(locale: Locale, slug: string) {
  return `/${locale}/author/${slug}`;
}
