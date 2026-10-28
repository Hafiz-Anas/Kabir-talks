import { TrendingUp } from "lucide-react";
import Link from "next/link";

import type { Locale } from "@/i18n";
import { articlePath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import type { TrendingCard } from "@/server/public/trending";

/**
 * Trending stories (Phase 7): a numbered list, on the homepage and beside
 * articles. Nothing is rendered when there is nothing to show.
 */
export function TrendingList({
  locale,
  items,
  labels,
  variant = "home",
}: {
  locale: Locale;
  items: TrendingCard[];
  labels: { title: string; description: string };
  variant?: "home" | "sidebar";
}) {
  if (items.length === 0) return null;
  const id = `trending-${variant}`;
  return (
    <section
      aria-labelledby={id}
      className={cn("space-y-4", variant === "home" && "rounded-md border border-gold-muted/40 bg-obsidian p-6 sm:p-8")}
    >
      <div className="flex items-start gap-4">
        {variant === "home" && (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-muted/60 text-gold">
            <TrendingUp className="size-5" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h2 id={id} className={cn(variant === "home" ? "text-xl text-ivory sm:text-2xl" : "text-xs font-medium tracking-[0.14em] text-gold uppercase")}>
            {labels.title}
          </h2>
          {variant === "home" && <p className="text-sm text-grey">{labels.description}</p>}
        </div>
      </div>
      <ol className="divide-y divide-border">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
            <span aria-hidden className="w-6 shrink-0 font-serif text-2xl leading-none text-gold-muted tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[0.6875rem] font-medium tracking-[0.12em] text-gold uppercase">{item.categoryName}</p>
              <Link
                href={articlePath(locale, item.categorySlug, item.slug)}
                className={cn(
                  "block text-ivory transition-colors hover:text-gold-soft focus-visible:text-gold-soft",
                  // Nastaliq needs its own font and generous line height (font-serif would override it).
                  locale === "ur" ? "font-urdu text-base/loose" : "font-serif text-base/snug",
                )}
              >
                {item.title}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
