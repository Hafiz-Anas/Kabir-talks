import Link from "next/link";

import { AuthorPhoto } from "@/components/authors/author-photo";
import { SectionHeading } from "@/components/section-heading";
import type { Locale } from "@/i18n";
import type { ArticleCardData } from "@/lib/articles/public";
import { formatPublicDate } from "@/lib/format";
import { articlePath, categoryPath } from "@/lib/urls";

import { OpinionLabel } from "./opinion-label";

/**
 * Phase 7C: homepage "Opinion" strip — the latest opinion pieces, each led by
 * its author's photo and name. Renders nothing when there are none.
 */
export function OpinionStrip({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: ArticleCardData[];
  labels: { title: string; label: string; viewAll: string };
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="opinion-strip" data-opinion-strip>
      <SectionHeading id="opinion-strip" title={labels.title} href={categoryPath(locale, items[0].categorySlug)} linkLabel={labels.viewAll} />
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <article className="group relative flex h-full flex-col gap-4 rounded-md border border-border bg-obsidian p-5">
              <div className="flex items-center gap-3">
                <AuthorPhoto name={item.author.name} photoUrl={item.author.photoUrl} size={56} />
                <div className="min-w-0 space-y-1">
                  <OpinionLabel label={labels.label} />
                  <p className="text-sm break-words text-ivory">{item.author.nameIsEnglish ? <bdi lang="en">{item.author.name}</bdi> : item.author.name}</p>
                </div>
              </div>
              <h3 className="text-lg text-ivory transition-colors group-hover:text-gold-soft">
                <Link
                  href={articlePath(locale, item.categorySlug, item.slug)}
                  className="after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {item.title}
                </Link>
              </h3>
              <p className="mt-auto text-xs text-grey">
                <time dateTime={item.publishedAt}>{formatPublicDate(item.publishedAt, locale)}</time>
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
