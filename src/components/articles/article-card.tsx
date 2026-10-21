import Image from "next/image";
import Link from "next/link";

import { type Dictionary, fill, type Locale } from "@/i18n";
import type { ArticleCardData } from "@/lib/articles/public";
import { formatPublicDate } from "@/lib/format";
import { articlePath } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { CoverPlaceholder } from "./cover-placeholder";

/**
 * The one article card used across the public site (homepage, listings,
 * search, related). No hooks or server-only imports, so the homepage
 * "Load more" Client Component can render it too.
 *
 * The headline link stretches over the whole card (after:inset-0), so the
 * card is one click/tap target with a single, accessible link name.
 */

export type ArticleCardVariant = "large" | "medium" | "compact";

const sizes: Record<ArticleCardVariant, string> = {
  large: "(min-width: 1024px) 720px, 100vw",
  medium: "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw",
  compact: "160px",
};

export function ArticleCard({
  article,
  locale,
  labels,
  variant = "medium",
  showExcerpt = variant !== "compact",
  priority = false,
  headingLevel = 3,
  className,
}: {
  article: ArticleCardData;
  locale: Locale;
  labels: Pick<Dictionary["common"], "minRead">;
  variant?: ArticleCardVariant;
  showExcerpt?: boolean;
  /** Set on the first, above-the-fold card (homepage hero, category lead). */
  priority?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const compact = variant === "compact";

  return (
    <article
      className={cn(
        "group relative",
        compact ? "grid grid-cols-[minmax(0,1fr)_6.5rem] gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]" : "flex flex-col gap-4",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-sm bg-obsidian-raised",
          compact ? "order-last aspect-square self-start sm:aspect-[4/3]" : variant === "large" ? "aspect-[16/9]" : "aspect-[3/2]",
        )}
      >
        {article.coverImageUrl ? (
          <Image
            src={article.coverImageUrl}
            alt={article.coverImageAlt ?? ""}
            fill
            sizes={sizes[variant]}
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder size={variant} />
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium tracking-[0.12em] text-gold uppercase">{article.categoryName}</p>
        <Heading
          className={cn(
            "text-ivory transition-colors group-hover:text-gold-soft",
            variant === "large" ? "text-3xl sm:text-4xl" : compact ? "text-lg" : "text-xl",
          )}
        >
          <Link
            href={articlePath(locale, article.categorySlug, article.slug)}
            className="rounded-sm after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-4 focus-visible:after:ring-offset-black"
          >
            {article.title}
          </Link>
        </Heading>
        {showExcerpt && article.excerpt && (
          <p className={cn("text-grey", variant === "large" ? "text-base sm:text-lg" : "line-clamp-3 text-sm")}>
            {article.excerpt}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-grey-dim">
          <time dateTime={article.publishedAt}>{formatPublicDate(article.publishedAt, locale)}</time>
          {article.readingMinutes > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{fill(labels.minRead, { minutes: article.readingMinutes })}</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
