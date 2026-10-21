import type { Locale } from "@/i18n/config";

/**
 * Public URL builders. Pure, so they work on client and server; pass the
 * site URL in from the server (env.NEXT_PUBLIC_SITE_URL).
 */

export function articlePath(locale: Locale, categorySlug: string, articleSlug: string) {
  return `/${locale}/${categorySlug}/${articleSlug}`;
}

export function categoryPath(locale: Locale, categorySlug: string) {
  return `/${locale}/${categorySlug}`;
}

export function tagPath(locale: Locale, tagSlug: string) {
  return `/${locale}/tags/${tagSlug}`;
}

/** Public URL of a listing page: page 1 is the bare path, later pages add ?page=N. */
export function listingPagePath(basePath: string, page: number) {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

/**
 * Internal static route that serves ?page=N (src/proxy.ts rewrites to it):
 * /en/sports?page=2 → /en/sports/p/2. Only the ?page form is ever linked.
 */
export const PAGED_SEGMENT = "p";

export function absoluteUrl(siteUrl: string, path: string) {
  return `${siteUrl.replace(/\/+$/, "")}${path}`;
}

export type ShareNetwork = "whatsapp" | "facebook" | "x" | "linkedin" | "telegram";

/** Standard share-intent URLs for each network. */
export function shareUrl(network: ShareNetwork, url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (network) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://x.com/intent/post?url=${u}&text=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
  }
}
