import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleListing } from "@/components/articles/article-listing";
import { fill, getDictionary, isLocale } from "@/i18n";
import { LISTING_PAGE_SIZE, parsePageParam } from "@/lib/articles/public";
import { metaDescription, pageMetadata } from "@/lib/seo";
import { categoryPath } from "@/lib/urls";
import { countArticles, getPublicCategory, listArticleCards, listPublicCategories } from "@/server/public/articles";

/**
 * Section page: lead story, then a grid, paginated with ?page=N.
 *
 * Reading ?page makes this page render per request (the data itself is
 * cached), and `instant = false` lets it block instead of streaming, so
 * unknown sections and out-of-range pages return a real 404 status.
 */
export const instant = false;

export async function generateStaticParams() {
  const categories = await listPublicCategories();
  // Cache Components needs at least one param; the placeholder simply 404s.
  return categories.length ? categories.map((category) => ({ categorySlug: category.slug })) : [{ categorySlug: "__none__" }];
}

async function resolve({ params, searchParams }: PageProps<"/[locale]/[categorySlug]">) {
  const [{ locale, categorySlug }, query] = await Promise.all([params, searchParams]);
  const page = parsePageParam(query.page);
  if (!isLocale(locale) || page === null) notFound();
  const category = await getPublicCategory(categorySlug);
  if (!category) notFound();

  const total = await countArticles({ locale, categorySlug });
  const pages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (page > pages) notFound();

  return {
    locale,
    page,
    pages,
    category,
    name: locale === "en" ? category.nameEn : category.nameUr,
    description: (locale === "en" ? category.descriptionEn : category.descriptionUr) ?? null,
  };
}

export async function generateMetadata(props: PageProps<"/[locale]/[categorySlug]">): Promise<Metadata> {
  const { locale, page, category, name, description } = await resolve(props);
  const dict = getDictionary(locale);
  const path = categoryPath(locale, category.slug) + (page > 1 ? `?page=${page}` : "");
  return pageMetadata({
    locale,
    path,
    title: page > 1 ? `${name} — ${fill(dict.listing.page, { page })}` : name,
    description: metaDescription(description, dict.site.description),
  });
}

export default async function CategoryPage(props: PageProps<"/[locale]/[categorySlug]">) {
  const { locale, page, pages, category, name, description } = await resolve(props);
  const dict = getDictionary(locale);
  const articles = await listArticleCards({
    locale,
    categorySlug: category.slug,
    limit: LISTING_PAGE_SIZE,
    offset: (page - 1) * LISTING_PAGE_SIZE,
  });

  return (
    <ArticleListing
      locale={locale}
      dict={dict}
      heading={name}
      description={description}
      articles={articles}
      page={page}
      pages={pages}
      basePath={categoryPath(locale, category.slug)}
      emptyText={dict.listing.emptyCategory}
    />
  );
}
