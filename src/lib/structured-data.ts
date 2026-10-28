import type { Locale } from "@/i18n/config";

/**
 * schema.org JSON-LD builders (Phase 7). Pure: pass absolute URLs in.
 * Rendered by components/json-ld.tsx.
 */

export type JsonLd = Record<string, unknown>;

const LANGUAGE: Record<Locale, string> = { en: "en", ur: "ur" };

export function organizationLd(site: { name: string; url: string; logo: string }): JsonLd {
  return {
    "@type": "NewsMediaOrganization",
    "@id": `${site.url}/#organization`,
    name: site.name,
    url: site.url,
    logo: { "@type": "ImageObject", url: site.logo, width: 512, height: 512 },
  };
}

export function websiteLd(site: { name: string; url: string; locale: Locale; searchUrl: string }): JsonLd {
  return {
    "@type": "WebSite",
    "@id": `${site.url}/#website-${site.locale}`,
    name: site.name,
    url: `${site.url}/${site.locale}`,
    inLanguage: LANGUAGE[site.locale],
    publisher: { "@id": `${site.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.searchUrl}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

export function newsArticleLd(article: {
  url: string;
  headline: string;
  description: string | null;
  images: string[];
  datePublished: string;
  dateModified: string;
  locale: Locale;
  section: string;
  keywords: string[];
  author: { name: string; isOrganization: boolean };
  site: { name: string; url: string; logo: string };
}): JsonLd {
  return {
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": article.url },
    url: article.url,
    // Google shows up to 110 characters.
    headline: article.headline.length > 110 ? `${article.headline.slice(0, 109)}…` : article.headline,
    ...(article.description ? { description: article.description } : {}),
    image: article.images,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    inLanguage: LANGUAGE[article.locale],
    articleSection: article.section,
    ...(article.keywords.length ? { keywords: article.keywords.join(", ") } : {}),
    author: article.author.isOrganization
      ? { "@type": "Organization", name: article.author.name, url: article.site.url }
      : { "@type": "Person", name: article.author.name },
    publisher: {
      "@type": "NewsMediaOrganization",
      "@id": `${article.site.url}/#organization`,
      name: article.site.name,
      url: article.site.url,
      logo: { "@type": "ImageObject", url: article.site.logo, width: 512, height: 512 },
    },
  };
}

/** One <script> holds a @graph of nodes. "<" is escaped so no text can close the script tag. */
export function serializeJsonLd(nodes: JsonLd[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\u003c");
}
