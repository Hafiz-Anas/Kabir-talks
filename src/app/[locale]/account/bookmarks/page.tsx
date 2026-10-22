import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArticleCard } from "@/components/articles/article-card";
import { RemoveBookmark } from "@/components/bookmarks/remove-bookmark";
import { Pagination } from "@/components/pagination";
import { SkeletonCard } from "@/components/skeleton-card";
import { cardLabels, type Dictionary, getDictionary, isLocale, type Locale } from "@/i18n";
import { parsePageParam } from "@/lib/articles/public";
import { requireUser } from "@/lib/auth-guards";
import { pageMetadata } from "@/lib/seo";
import { listBookmarks } from "@/server/bookmarks";

/**
 * "My bookmarks": the reader's saved articles, newest saved first, 12 per
 * page (?page=N). Private and dynamic; only articles still published and
 * available in this language are listed (other bookmarks are kept, hidden).
 */

export async function generateMetadata({ params }: PageProps<"/[locale]/account/bookmarks">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { bookmarks } = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}/account/bookmarks`,
    title: bookmarks.pageTitle,
    description: bookmarks.pageIntro,
    noindex: true,
  });
}

export default async function BookmarksPage({ params, searchParams }: PageProps<"/[locale]/account/bookmarks">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="space-y-10 py-10 sm:py-12">
      <header className="kt-rule space-y-2 pt-6">
        <h1 className="text-4xl text-ivory">{dict.bookmarks.pageTitle}</h1>
        <p className="text-grey">{dict.bookmarks.pageIntro}</p>
      </header>
      <Suspense fallback={<BookmarksSkeleton />}>
        <BookmarkList locale={locale} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BookmarkList({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[locale]/account/bookmarks">["searchParams"];
}) {
  const page = parsePageParam((await searchParams).page);
  const path = `/${locale}/account/bookmarks`;
  const session = await requireUser(page && page > 1 ? `${path}?page=${page}` : path, locale);
  if (page === null) notFound();
  const { items, pages } = await listBookmarks(session.user.id, locale, page);

  if (items.length === 0 && page === 1) {
    return (
      <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian px-6 py-16 text-center text-grey">
        {dict.bookmarks.empty}
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((article) => (
          <li key={article.id} className="space-y-3">
            <ArticleCard article={article} locale={locale} labels={cardLabels(dict)} headingLevel={2} />
            <RemoveBookmark articleId={article.id} label={dict.bookmarks.removeButton} errorLabel={dict.bookmarks.error} />
          </li>
        ))}
      </ul>
      <Pagination basePath={path} page={page} pages={pages} labels={dict.listing} />
    </>
  );
}

function BookmarksSkeleton() {
  return (
    <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
