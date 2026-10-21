"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { type Dictionary, fill, type Locale, locales } from "@/i18n";
import { cn } from "@/lib/utils";

type Version = { title: string; category: string; href: string; date: string };

/**
 * Body of the article 404. If the article is published in the OTHER language,
 * says so and links to it; otherwise shows `fallback` (the normal 404 text).
 *
 * A not-found page gets no params and the article page must stay fully static
 * (no headers()), so this reads the URL with useParams() and asks
 * /api/public/article-locales/{slug} — the client-side approach the Next.js
 * docs give for not-found pages. The 404 status and noindex are already set.
 */
export function OtherLanguageNotice({
  locale,
  dict,
  fallback,
}: {
  locale: Locale;
  dict: Pick<Dictionary, "article" | "languageName" | "common">;
  fallback: ReactNode;
}) {
  const params = useParams<{ articleSlug?: string }>();
  const pathname = usePathname();
  // /{locale}/{category}/{slug}; the path is the fallback if params aren't populated here.
  const slug = params.articleSlug ?? decodeURIComponent(pathname.split("/")[3] ?? "");
  const [result, setResult] = useState<{ slug: string; other: Locale; version: Version } | "none" | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/public/article-locales/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { versions: Partial<Record<Locale, Version>> } | null) => {
        if (cancelled) return;
        const other = locales.find((l) => l !== locale && data?.versions[l]);
        setResult(other ? { slug, other, version: data!.versions[other]! } : "none");
      })
      .catch(() => !cancelled && setResult("none"));
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  if (!slug || result === "none") return <>{fallback}</>;
  // Until the answer arrives, keep the space quiet rather than flashing "Page not found".
  if (result === null || result.slug !== slug) return <div aria-busy="true" className="min-h-[50dvh]" />;

  const { other, version } = result;
  const language = dict.languageName[other];

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-20 text-center sm:px-6">
      <div className="space-y-3">
        <h1 className="text-3xl text-ivory sm:text-4xl">{fill(dict.article.unavailableTitle, { language })}</h1>
        <p className="text-grey">{fill(dict.article.unavailableDescription, { current: dict.languageName[locale] })}</p>
      </div>

      <Link
        href={version.href}
        lang={other}
        dir={other === "ur" ? "rtl" : "ltr"}
        hrefLang={other}
        className="block rounded-md border border-gold-muted/60 bg-obsidian p-6 text-start transition-colors hover:border-gold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="block text-xs tracking-[0.12em] text-gold uppercase">{version.category}</span>
        <span className={cn("mt-2 block text-2xl text-ivory", other === "ur" ? "font-urdu" : "font-serif leading-snug")}>
          {version.title}
        </span>
        <span className="mt-2 block text-sm text-grey">{version.date}</span>
      </Link>

      <p className="flex flex-wrap items-center justify-center gap-6">
        <Link
          href={version.href}
          hrefLang={other}
          className="rounded-sm bg-gold px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gold-soft"
        >
          {fill(dict.article.readIn, { language })}
        </Link>
        <Link href={`/${locale}`} className="text-sm text-gold hover:text-gold-soft">
          {dict.common.backHome}
        </Link>
      </p>
    </div>
  );
}
