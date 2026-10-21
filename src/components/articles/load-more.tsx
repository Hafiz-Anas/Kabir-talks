"use client";

import { useState } from "react";

import type { Dictionary, Locale } from "@/i18n";
import { type ArticleCardData, FEED_PAGE_SIZE } from "@/lib/articles/public";

import { ArticleCard } from "./article-card";

/**
 * "Load more" for the homepage Latest feed. The first page is server-rendered
 * (crawlable); this appends later pages from GET /api/public/articles.
 */
export function LoadMore({
  locale,
  exclude,
  initialOffset,
  labels,
}: {
  locale: Locale;
  /** Hero and top stories, already shown above the feed. */
  exclude: string[];
  initialOffset: number;
  labels: Pick<Dictionary["home"], "loadMore" | "loading" | "loadError"> & Pick<Dictionary["common"], "minRead">;
}) {
  const [items, setItems] = useState<ArticleCardData[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      const params = new URLSearchParams({ locale, offset: String(offset) });
      if (exclude.length) params.set("exclude", exclude.join(","));
      const response = await fetch(`/api/public/articles?${params}`);
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { items: ArticleCardData[]; hasMore: boolean };
      // Skip anything already on screen (e.g. a story published since the page loaded shifted the list).
      setItems((current) => [...current, ...data.items.filter((item) => !current.some((c) => c.id === item.id))]);
      setOffset((value) => value + FEED_PAGE_SIZE);
      setHasMore(data.hasMore);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {items.length > 0 && (
        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} labels={labels} />
          ))}
        </div>
      )}
      {hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={state === "loading"}
            className="h-11 rounded-sm border border-gold-muted px-6 text-sm text-ivory transition-colors hover:border-gold hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          >
            {state === "loading" ? labels.loading : labels.loadMore}
          </button>
          <p role="status" aria-live="polite" className="text-sm text-destructive">
            {state === "error" ? labels.loadError : ""}
          </p>
        </div>
      )}
    </>
  );
}
