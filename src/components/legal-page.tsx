import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/content/article-body";
import type { SitePageSlug } from "@/db/schema";
import { fill, getDictionary, isLocale } from "@/i18n";
import { docToPlainText, type ArticleDoc } from "@/lib/content/document";
import { formatPublicDate } from "@/lib/format";
import { metaDescription, pageMetadata } from "@/lib/seo";
import { getSitePage } from "@/server/public/pages";

/**
 * Privacy Policy and Terms of Use (Phase 7): admin-edited (Admin → Pages),
 * rendered with the shared sanitizing renderer. Static; saving re-renders.
 */

export async function legalMetadata(slug: SitePageSlug, rawLocale: string): Promise<Metadata> {
  if (!isLocale(rawLocale)) notFound();
  const page = await getSitePage(slug);
  if (!page) notFound();
  const dict = getDictionary(rawLocale);
  const body = (rawLocale === "en" ? page.bodyEn : page.bodyUr) as ArticleDoc | null;
  return pageMetadata({
    locale: rawLocale,
    path: `/${rawLocale}/${slug}`,
    title: rawLocale === "en" ? page.titleEn : page.titleUr,
    description: metaDescription(docToPlainText(body), dict.site.description),
  });
}

export async function LegalPage({ slug, rawLocale }: { slug: SitePageSlug; rawLocale: string }) {
  if (!isLocale(rawLocale)) notFound();
  const page = await getSitePage(slug);
  if (!page) notFound();
  const dict = getDictionary(rawLocale);
  const title = rawLocale === "en" ? page.titleEn : page.titleUr;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="kt-rule space-y-3 pt-6">
        <h1 className="text-4xl text-ivory sm:text-5xl">{title}</h1>
        <p className="text-sm text-grey">
          {fill(dict.legal.lastUpdated, { date: formatPublicDate(page.updatedAt, rawLocale) })}
        </p>
      </header>
      <ArticleBody doc={rawLocale === "en" ? page.bodyEn : page.bodyUr} locale={rawLocale} />
    </div>
  );
}
