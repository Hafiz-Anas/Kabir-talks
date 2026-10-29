import type { ReactNode } from "react";

import { Pagination } from "@/components/pagination";
import { cardLabels, type Dictionary, type Locale } from "@/i18n";
import type { ArticleCardData } from "@/lib/articles/public";

import { ArticleCard } from "./article-card";

/** Category, tag and author pages: title block, lead story on page 1, card grid, pagination. */
export function ArticleListing({
  locale,
  dict,
  eyebrow,
  heading,
  description,
  header,
  listHeading,
  articles,
  page,
  pages,
  basePath,
  emptyText,
}: {
  locale: Locale;
  dict: Dictionary;
  eyebrow?: ReactNode;
  heading: ReactNode;
  description?: string | null;
  /** Replaces the default title block (author pages). */
  header?: ReactNode;
  /** A heading above the stories (author pages); cards then use h3. */
  listHeading?: string;
  articles: ArticleCardData[];
  page: number;
  pages: number;
  basePath: string;
  emptyText: string;
}) {
  // Page 1 opens with a large lead story; later pages are grid only.
  const lead = page === 1 ? articles[0] : undefined;
  const rest = lead ? articles.slice(1) : articles;
  const cardHeading = listHeading ? 3 : 2;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {header ?? (
        <header className="kt-rule max-w-3xl space-y-3 pt-6">
          {eyebrow && <p className="text-xs font-medium tracking-[0.12em] text-gold uppercase">{eyebrow}</p>}
          <h1 className="text-4xl text-ivory sm:text-5xl">{heading}</h1>
          {description && <p className="text-lg text-grey">{description}</p>}
        </header>
      )}
      {listHeading && <h2 className="border-t border-border pt-8 text-2xl text-ivory">{listHeading}</h2>}

      {articles.length === 0 ? (
        <p className="rounded-md border border-dashed border-gold-muted/50 bg-obsidian px-6 py-16 text-center text-grey">
          {emptyText}
        </p>
      ) : (
        <>
          {lead && (
            <ArticleCard
              article={lead}
              locale={locale}
              labels={cardLabels(dict)}
              variant="large"
              priority
              headingLevel={cardHeading}
              className="lg:grid lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-10"
            />
          )}
          {rest.length > 0 && (
            <div className="grid gap-x-8 gap-y-12 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  locale={locale}
                  labels={cardLabels(dict)}
                  headingLevel={cardHeading}
                  priority={!lead && index < 3}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Pagination basePath={basePath} page={page} pages={pages} labels={dict.listing} />
    </div>
  );
}
