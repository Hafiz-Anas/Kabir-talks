import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleListing } from "@/components/articles/article-listing";
import { fill, getDictionary, isLocale } from "@/i18n";
import { LISTING_PAGE_SIZE, parsePageParam, tagName } from "@/lib/articles/public";
import { pageMetadata } from "@/lib/seo";
import { countArticles, getPublicTag, listArticleCards, listPublicTagSlugs } from "@/server/public/articles";

/** Articles with one tag, in the current language. Same rendering rules as the section page. */
export const instant = false;

export async function generateStaticParams() {
  const slugs = await listPublicTagSlugs();
  return slugs.length ? slugs.map((tagSlug) => ({ tagSlug })) : [{ tagSlug: "__none__" }];
}

const tagPath = (locale: string, slug: string) => `/${locale}/tags/${slug}`;

async function resolve({ params, searchParams }: PageProps<"/[locale]/tags/[tagSlug]">) {
  const [{ locale, tagSlug }, query] = await Promise.all([params, searchParams]);
  const page = parsePageParam(query.page);
  if (!isLocale(locale) || page === null) notFound();
  const tag = await getPublicTag(tagSlug);
  if (!tag) notFound();

  const total = await countArticles({ locale, tagSlug: tag.slug });
  const pages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (page > pages) notFound();
  return { locale, page, pages, tag, name: tagName(tag, locale) };
}

export async function generateMetadata(props: PageProps<"/[locale]/tags/[tagSlug]">): Promise<Metadata> {
  const { locale, page, tag, name } = await resolve(props);
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: tagPath(locale, tag.slug) + (page > 1 ? `?page=${page}` : ""),
    title: `${dict.listing.tag}: ${name}${page > 1 ? ` — ${fill(dict.listing.page, { page })}` : ""}`,
    description: dict.site.description,
  });
}

export default async function TagPage(props: PageProps<"/[locale]/tags/[tagSlug]">) {
  const { locale, page, pages, tag, name } = await resolve(props);
  const dict = getDictionary(locale);
  const articles = await listArticleCards({
    locale,
    tagSlug: tag.slug,
    limit: LISTING_PAGE_SIZE,
    offset: (page - 1) * LISTING_PAGE_SIZE,
  });
  // A tag with no Urdu name shows its English name, marked as English text.
  const englishName = locale === "ur" && !tag.nameUr;

  return (
    <ArticleListing
      locale={locale}
      dict={dict}
      eyebrow={dict.listing.tag}
      heading={englishName ? <bdi lang="en">{name}</bdi> : name}
      articles={articles}
      page={page}
      pages={pages}
      basePath={tagPath(locale, tag.slug)}
      emptyText={dict.listing.emptyTag}
    />
  );
}
