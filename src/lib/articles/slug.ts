/** URL slugs: lowercase ASCII words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 100;

export function slugify(input: string, max = SLUG_MAX): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: café → cafe
    .toLowerCase()
    .replace(/['’]/g, "") // don't → dont
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function isValidSlug(value: string) {
  return value.length > 0 && value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

export const SLUG_HELP = "Lowercase letters, numbers and single hyphens only (e.g. budget-2026-explained).";

/**
 * Category slugs that would clash with routes: /{locale}/search, /{locale}/tags/…,
 * /{locale}/about, plus the locale codes and internal top-level paths.
 */
export const RESERVED_CATEGORY_SLUGS = ["en", "ur", "search", "tags", "about", "admin", "login", "api"] as const;

export function isReservedCategorySlug(slug: string) {
  return (RESERVED_CATEGORY_SLUGS as readonly string[]).includes(slug);
}
