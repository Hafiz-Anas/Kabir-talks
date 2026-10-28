import "server-only";

import type { Metadata } from "next";

import { getDictionary, type Locale, locales } from "@/i18n";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/urls";

/**
 * Builds per-page metadata: title, description, canonical, hreflang,
 * Open Graph and Twitter card. Every public page goes through this so link
 * previews on WhatsApp, Facebook and X look the same everywhere.
 */

export const OG_LOCALE: Record<Locale, string> = { en: "en_US", ur: "ur_PK" };
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const siteUrl = (path: string) => absoluteUrl(env.NEXT_PUBLIC_SITE_URL, path);

/** Site identity for structured data (src/lib/structured-data.ts). */
export function siteIdentity(locale: Locale) {
  return { name: getDictionary(locale).site.name, url: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ""), logo: siteUrl("/brand/logo.png") };
}

/** Branded share image for pages without their own (homepage, sections, tags, search, about). */
export function siteShareImage(locale: Locale) {
  return { url: siteUrl(`/og/site/${locale}`), ...OG_IMAGE_SIZE, alt: getDictionary(locale).site.name };
}

/**
 * Share image for an article: the generated 1200×630 card (cover photo, or
 * the branded title card when there is no cover). `version` changes when the
 * article is edited, so networks that cache previews by URL pick up the new image.
 */
export function articleShareImage(locale: Locale, slug: string, version: string, alt: string) {
  const v = new Date(version).getTime().toString(36);
  return { url: siteUrl(`/og/article/${locale}/${slug}?v=${v}`), ...OG_IMAGE_SIZE, alt };
}

type ShareImage = { url: string; width?: number; height?: number; alt: string };

export function pageMetadata({
  locale,
  path,
  title,
  description,
  languages = "all",
  image,
  noindex = false,
  absoluteTitle = false,
  article,
}: {
  locale: Locale;
  /** Path of this page in this locale, e.g. /en/sports. Becomes the canonical URL. */
  path: string;
  title: string;
  description: string;
  /**
   * hreflang alternates. "all" = the same path exists in every locale (swap the
   * prefix); an object lists only the versions that exist; null = none.
   */
  languages?: "all" | Partial<Record<Locale, string>> | null;
  image?: ShareImage;
  noindex?: boolean;
  /** Use the title as-is instead of "Title · Kabir Talks". */
  absoluteTitle?: boolean;
  article?: { publishedTime: string; modifiedTime: string; section: string; tags: string[] };
}): Metadata {
  const dict = getDictionary(locale);
  const canonical = siteUrl(path);
  const shareImage = image ?? siteShareImage(locale);

  let alternates: Record<string, string> | undefined;
  if (languages === "all") {
    alternates = Object.fromEntries(locales.map((l) => [l, siteUrl(path.replace(/^\/(en|ur)(?=\/|$)/, `/${l}`))]));
  } else if (languages) {
    alternates = Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, siteUrl(p)]));
  }
  // x-default: the English version when there is one, otherwise the only version.
  if (alternates && Object.keys(alternates).length > 1) {
    alternates["x-default"] = alternates.en ?? Object.values(alternates)[0];
  } else {
    alternates = undefined;
  }

  const fullTitle = absoluteTitle ? title : `${title} · ${dict.site.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: alternates,
      // Phase 7: lets feed readers find the language's RSS feed from any page.
      types: { "application/rss+xml": [{ url: siteUrl(`/${locale}/rss.xml`), title: `${dict.site.name} (${dict.languageName[locale]})` }] },
    },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: dict.site.name,
      locale: OG_LOCALE[locale],
      alternateLocale: alternates ? locales.filter((l) => l !== locale && alternates[l]).map((l) => OG_LOCALE[l]) : undefined,
      images: [shareImage],
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            section: article.section,
            tags: article.tags,
          }
        : { type: "website" }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: shareImage.url, alt: shareImage.alt }],
    },
  };
}

/** Trims text to a meta-description length on a word boundary. */
export function metaDescription(text: string | null | undefined, fallback: string, max = 160): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim() || fallback;
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}
