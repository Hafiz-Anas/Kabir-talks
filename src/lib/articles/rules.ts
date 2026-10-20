import { type ArticleDoc, isDocEmpty } from "@/lib/content/document";

/**
 * Article rules shared by the editor (live checklist) and the server
 * (authoritative check before publishing). Pure: no server imports.
 */

export const LIMITS = {
  title: 200,
  excerpt: 500,
  seoTitle: 120,
  seoDescription: 320,
  alt: 300,
  tags: 20,
  tagName: 40,
} as const;

/** Recommended lengths shown by the SEO character counters. */
export const SEO_RECOMMENDED = { title: 60, description: 160 } as const;

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type LocaleContent = {
  title: string | null | undefined;
  body: ArticleDoc | null | undefined;
};

export type ReadinessInput = {
  categoryId: string | null | undefined;
  slug: string | null | undefined;
  en: LocaleContent;
  ur: LocaleContent;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
};

export type ChecklistItem = { key: string; label: string; done: boolean };

export function isLocaleComplete(content: LocaleContent) {
  return Boolean(content.title?.trim()) && !isDocEmpty(content.body);
}

export function completedLocales(input: Pick<ReadinessInput, "en" | "ur">): ("en" | "ur")[] {
  return (["en", "ur"] as const).filter((locale) => isLocaleComplete(input[locale]));
}

/** Everything publish needs, with done/not-done flags (for the checklist UI). */
export function publishChecklist(input: ReadinessInput): ChecklistItem[] {
  const en = isLocaleComplete(input.en);
  const ur = isLocaleComplete(input.ur);
  const items: ChecklistItem[] = [
    { key: "category", label: "Choose a category", done: Boolean(input.categoryId) },
    { key: "slug", label: "Set a URL slug", done: Boolean(input.slug?.trim()) },
    {
      key: "language",
      label: "Complete at least one language (title and body) — English or Urdu",
      done: en || ur,
    },
  ];
  if (input.coverImageUrl) {
    items.push({ key: "coverAlt", label: "Add alt text for the cover image", done: Boolean(input.coverImageAlt?.trim()) });
  }
  return items;
}

export function missingForPublish(input: ReadinessInput): ChecklistItem[] {
  return publishChecklist(input).filter((item) => !item.done);
}

/** "empty" | "partial" | "complete" — drives the dot on each language tab. */
export function localeState(content: LocaleContent & { excerpt?: string | null }) {
  const hasTitle = Boolean(content.title?.trim());
  const hasBody = !isDocEmpty(content.body);
  if (hasTitle && hasBody) return "complete" as const;
  if (hasTitle || hasBody || Boolean(content.excerpt?.trim())) return "partial" as const;
  return "empty" as const;
}
