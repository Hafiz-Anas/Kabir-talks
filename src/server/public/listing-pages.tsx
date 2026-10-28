import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleListing } from "@/components/articles/article-listing";
import { JsonLdScript } from "@/components/json-ld";
import { fill, getDictionary, isLocale } from "@/i18n";
import { LISTING_PAGE_SIZE, parsePageParam, tagName } from "@/lib/articles/public";
import { metaDescription, pageMetadata, siteUrl } from "@/lib/seo";
import { breadcrumbLd } from "@/lib/structured-data";
import { categoryPath, listingPagePath, tagPath } from "@/lib/urls";

import {
  countArticles,
  getPublicCategory,
  getPublicTag,
  listArticleCards,
  listPublicCategories,
  listPublicTagSlugs,
} from "./articles";

/**
 * Section and tag listing pages, shared by page 1 (/en/sports) and later
 * pages (/en/sports?page=2, which src/proxy.ts rewrites to the static route
 * /en/sports/p/2). Everything here is cached data only, so the pages are
 * fully static (`ensureStatic = 'navigation'`): unknown sections or tags and
 * out-of-range pages render to a real 404 before anything is sent.
 */

type Kind = "category" | "tag";
type RawParams = { locale: string; slug: string; page?: string };

async function resolve(kind: Kind, raw: RawParams) {
  const page = parsePageParam(raw.page);
  // The paged route only serves 2+; page 1 lives at the bare path.
  if (!isLocale(raw.locale) || page === null || (raw.page !== undefined && page === 1)) notFound();
  const locale = raw.locale;

  if (kind === "category") {
    const category = await getPublicCategory(raw.slug);
    if (!category) notFound();
    const total = await countArticles({ locale, categorySlug: category.slug });
    const pages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
    if (page > pages) notFound();
    return {
      kind,
      locale,
      page,
      pages,
      slug: category.slug,
      basePath: categoryPath(locale, category.slug),
      name: locale === "en" ? category.nameEn : category.nameUr,
      englishName: false,
      description: (locale === "en" ? category.descriptionEn : category.descriptionUr) ?? null,
    };
  }

  const tag = await getPublicTag(raw.slug);
  if (!tag) notFound();
  const total = await countArticles({ locale, tagSlug: tag.slug });
  const pages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (page > pages) notFound();
  return {
    kind,
    locale,
    page,
    pages,
    slug: tag.slug,
    basePath: tagPath(locale, tag.slug),
    name: tagName(tag, locale),
    // A tag with no Urdu name shows its English name, marked as English text.
    englishName: locale === "ur" && !tag.nameUr,
    description: null,
  };
}

export async function listingMetadata(kind: Kind, raw: RawParams): Promise<Metadata> {
  const listing = await resolve(kind, raw);
  const dict = getDictionary(listing.locale);
  const suffix = listing.page > 1 ? ` — ${fill(dict.listing.page, { page: listing.page })}` : "";
  return pageMetadata({
    locale: listing.locale,
    path: listingPagePath(listing.basePath, listing.page),
    title: (kind === "tag" ? `${dict.listing.tag}: ${listing.name}` : listing.name) + suffix,
    description: metaDescription(listing.description, dict.site.description),
  });
}

export async function ListingPage({ kind, raw }: { kind: Kind; raw: RawParams }) {
  const listing = await resolve(kind, raw);
  const dict = getDictionary(listing.locale);
  const articles = await listArticleCards({
    locale: listing.locale,
    ...(kind === "category" ? { categorySlug: listing.slug } : { tagSlug: listing.slug }),
    limit: LISTING_PAGE_SIZE,
    offset: (listing.page - 1) * LISTING_PAGE_SIZE,
  });

  return (
    <>
      <JsonLdScript
        nodes={[
          breadcrumbLd([
            { name: dict.nav.home, url: siteUrl(`/${listing.locale}`) },
            { name: kind === "tag" ? `${dict.listing.tag}: ${listing.name}` : listing.name, url: siteUrl(listing.basePath) },
          ]),
        ]}
      />
      <ArticleListing
        locale={listing.locale}
        dict={dict}
        eyebrow={kind === "tag" ? dict.listing.tag : undefined}
        heading={listing.englishName ? <bdi lang="en">{listing.name}</bdi> : listing.name}
        description={listing.description}
        articles={articles}
        page={listing.page}
        pages={listing.pages}
        basePath={listing.basePath}
        emptyText={kind === "tag" ? dict.listing.emptyTag : dict.listing.emptyCategory}
      />
    </>
  );
}

async function listingSlugs(kind: Kind) {
  return kind === "category" ? (await listPublicCategories()).map((category) => category.slug) : listPublicTagSlugs();
}

/**
 * Params to prerender (per locale; the [locale] layout supplies it). Anything
 * else renders on its first request. Cache Components needs a non-empty list,
 * so a placeholder (which 404s) fills an empty one.
 */
export async function listingSlugParams(kind: Kind) {
  const slugs = await listingSlugs(kind);
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

/** Pages 2..n that exist now, for each section or used tag. */
export async function listingPagedParams(kind: Kind, locale: string) {
  const out: { slug: string; page: string }[] = [];
  if (isLocale(locale)) {
    for (const slug of await listingSlugs(kind)) {
      const total = await countArticles(kind === "category" ? { locale, categorySlug: slug } : { locale, tagSlug: slug });
      for (let page = 2; page <= Math.ceil(total / LISTING_PAGE_SIZE); page++) out.push({ slug, page: String(page) });
    }
  }
  return out.length ? out : [{ slug: "__none__", page: "2" }];
}
