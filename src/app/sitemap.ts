import type { MetadataRoute } from "next";

import { type Locale, locales } from "@/i18n";
import { siteUrl } from "@/lib/seo";
import { articlePath, categoryPath, tagPath } from "@/lib/urls";
import { authorPath } from "@/lib/authors";
import { listPublicCategories } from "@/server/public/articles";
import { listSitemapAuthors } from "@/server/public/authors";
import { listSitemapArticles, listSitemapTags } from "@/server/public/seo";

/**
 * /sitemap.xml (Phase 7): every public page, each with hreflang alternates
 * for the languages it exists in. Published articles only, and only in the
 * languages they're available in. Cached; publishing refreshes it.
 */

/** Pages that exist in both languages under the same path. */
const STATIC_PATHS = ["", "/about", "/contact", "/privacy", "/terms"];

type Entry = MetadataRoute.Sitemap[number];

function entries(paths: Partial<Record<Locale, string>>, extra: Omit<Entry, "url" | "alternates"> = {}): Entry[] {
  const available = locales.filter((l) => paths[l]);
  const languages =
    available.length > 1
      ? { ...Object.fromEntries(available.map((l) => [l, siteUrl(paths[l]!)])), "x-default": siteUrl(paths.en ?? paths[available[0]]!) }
      : undefined;
  return available.map((l) => ({ url: siteUrl(paths[l]!), ...extra, ...(languages ? { alternates: { languages } } : {}) }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, tags, authors] = await Promise.all([
    listSitemapArticles(),
    listPublicCategories(),
    listSitemapTags(),
    listSitemapAuthors(),
  ]);
  const newest = articles[0]?.updatedAt;

  return [
    ...STATIC_PATHS.flatMap((path) =>
      entries(Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])), {
        ...(path === "" && newest ? { lastModified: newest } : {}),
        changeFrequency: path === "" ? "hourly" : "monthly",
        priority: path === "" ? 1 : 0.3,
      }),
    ),
    ...categories.flatMap((category) =>
      entries(Object.fromEntries(locales.map((l) => [l, categoryPath(l, category.slug)])), { changeFrequency: "daily", priority: 0.7 }),
    ),
    ...articles.flatMap((article) =>
      entries(
        Object.fromEntries(locales.filter((l) => article[l]).map((l) => [l, articlePath(l, article.categorySlug, article.slug)])),
        { lastModified: article.updatedAt, changeFrequency: "weekly", priority: 0.8 },
      ),
    ),
    ...tags.flatMap((tag) =>
      entries(Object.fromEntries(locales.filter((l) => tag[l]).map((l) => [l, tagPath(l, tag.slug)])), {
        lastModified: tag.updatedAt,
        changeFrequency: "weekly",
        priority: 0.4,
      }),
    ),
    // Phase 7C: author pages, for authors with published articles, in the languages they have some.
    ...authors.flatMap((author) =>
      entries(Object.fromEntries(locales.filter((l) => author[l]).map((l) => [l, authorPath(l, author.slug)])), {
        lastModified: author.updatedAt,
        changeFrequency: "weekly",
        priority: 0.4,
      }),
    ),
  ];
}
