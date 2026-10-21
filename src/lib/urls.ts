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

/** Request header set by src/proxy.ts so the article not-found page knows which URL was asked for. */
export const ARTICLE_PATH_HEADER = "x-kt-article-path";

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
