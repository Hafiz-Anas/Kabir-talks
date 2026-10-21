import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArticleCard } from "@/components/articles/article-card";
import { Pagination } from "@/components/pagination";
import { SearchForm } from "@/components/search-form";
import { SkeletonCard } from "@/components/skeleton-card";
import { type Dictionary, fill, getDictionary, isLocale, type Locale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import {
  normalizeSearchQuery,
  SEARCH_MIN_LENGTH,
  SEARCH_PAGE_SIZE,
  searchArticles,
} from "@/server/public/articles";

/**
 * Search. The shell (heading) is static; results read ?q and ?page at
 * request time inside <Suspense>. Never indexed by search engines.
 */

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}/search`,
    title: dict.search.title,
    description: dict.search.intro,
    noindex: true,
    languages: null,
  });
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="kt-rule space-y-2 pt-6">
        <h1 className="text-4xl text-ivory sm:text-5xl">{dict.search.title}</h1>
        <p className="text-grey">{dict.search.intro}</p>
      </header>
      <Suspense
        fallback={
          <div className="space-y-8">
            <SearchForm locale={locale} labels={dict.search} />
            <SkeletonCard />
          </div>
        }
      >
        <Results locale={locale} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[locale]/search">["searchParams"];
}) {
  const raw = await searchParams;
  const query = normalizeSearchQuery(Array.isArray(raw.q) ? raw.q[0] : raw.q);
  const requestedPage = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 1 && requestedPage <= 1000 ? requestedPage : 1;
  const { items, total } = await searchArticles(locale, query, page);
  const pages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));

  return (
    <div className="space-y-8">
      <SearchForm locale={locale} labels={dict.search} defaultValue={query} />

      {query.length < SEARCH_MIN_LENGTH ? (
        query && <p className="text-grey">{fill(dict.search.tooShort, { min: SEARCH_MIN_LENGTH })}</p>
      ) : (
        <section aria-labelledby="search-results" className="space-y-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
            <h2 id="search-results" className="text-2xl text-ivory">
              <WithQuery template={dict.search.resultsFor} query={query} />
            </h2>
            <p className="text-sm text-grey" aria-live="polite">
              {total === 1 ? dict.search.resultCountOne : fill(dict.search.resultCount, { count: total })}
            </p>
          </div>

          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian px-6 py-12 text-center text-grey">
              <WithQuery template={dict.search.noResults} query={query} />
            </p>
          ) : (
            <ol className="space-y-8">
              {items.map((article) => (
                <li key={article.id} className="border-b border-border pb-8 last:border-b-0">
                  <ArticleCard article={article} locale={locale} labels={dict.common} variant="compact" showExcerpt />
                </li>
              ))}
            </ol>
          )}

          {page <= pages && (
            <Pagination
              basePath={`/${locale}/search`}
              page={page}
              pages={pages}
              labels={dict.listing}
              query={{ q: query }}
            />
          )}
        </section>
      )}
    </div>
  );
}

/** Puts the reader's query into a sentence, isolated so mixed-direction text displays correctly. */
function WithQuery({ template, query }: { template: string; query: string }) {
  const [before, after] = template.split("{query}");
  return (
    <>
      {before}
      <bdi className="text-gold-soft">{query}</bdi>
      {after}
    </>
  );
}
