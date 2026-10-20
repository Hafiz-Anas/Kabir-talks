import type { Dictionary } from "@/i18n";

/**
 * Header navigation categories. Mirrors the seeded categories (src/db/seed.ts).
 * Phase 4 replaces this with categories read from the database.
 */
export const NAV_CATEGORIES = [
  { slug: "current-affairs", labelKey: "currentAffairs" },
  { slug: "sports", labelKey: "sports" },
] as const satisfies ReadonlyArray<{ slug: string; labelKey: keyof Dictionary["nav"] }>;

export type NavCategorySlug = (typeof NAV_CATEGORIES)[number]["slug"];

export function isNavCategory(slug: string): slug is NavCategorySlug {
  return NAV_CATEGORIES.some((category) => category.slug === slug);
}
