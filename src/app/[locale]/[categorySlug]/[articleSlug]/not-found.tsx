import { headers } from "next/headers";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { NotFoundMessage } from "@/components/not-found-message";
import { defaultLocale, fill, getDictionary, isLocale, type Locale, locales } from "@/i18n";
import { formatPublicDate } from "@/lib/format";
import { ARTICLE_PATH_HEADER, articlePath } from "@/lib/urls";
import { getPublishedArticle } from "@/server/public/articles";

/**
 * 404 for article URLs. When the article is published but only in the other
 * language, says so and links to it ("This article is only available in
 * English"). The status stays 404 and the page is noindex (notFound() adds it).
 *
 * not-found files don't receive params, so src/proxy.ts passes the requested
 * path in a request header.
 */
export default async function ArticleNotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  return (
    <Suspense fallback={<div className="min-h-[60dvh]" />}>
      <Resolved locale={locale} />
    </Suspense>
  );
}

async function Resolved({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const path = (await headers()).get(ARTICLE_PATH_HEADER) ?? "";
  const slug = path.split("/")[3];
  const article = slug ? await getPublishedArticle(decodeURIComponent(slug)) : null;
  const other = locales.find((l) => l !== locale && article?.locales[l]);
  const content = other ? article?.locales[other] : null;
  if (!article || !other || !content) return <NotFoundMessage locale={locale} dict={dict} />;

  const language = dict.languageName[other];
  const href = articlePath(other, article.categorySlug, article.slug);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-20 text-center sm:px-6">
      <div className="space-y-3">
        <h1 className="text-3xl text-ivory sm:text-4xl">{fill(dict.article.unavailableTitle, { language })}</h1>
        <p className="text-grey">{fill(dict.article.unavailableDescription, { current: dict.languageName[locale] })}</p>
      </div>

      <Link
        href={href}
        lang={other}
        dir={other === "ur" ? "rtl" : "ltr"}
        hrefLang={other}
        className="block rounded-md border border-gold-muted/60 bg-obsidian p-6 text-start transition-colors hover:border-gold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="block text-xs tracking-[0.12em] text-gold uppercase">
          {other === "en" ? article.categoryNameEn : article.categoryNameUr}
        </span>
        <span className={`mt-2 block text-2xl text-ivory ${other === "ur" ? "font-urdu" : "font-serif leading-snug"}`}>
          {content.title}
        </span>
        <span className="mt-2 block text-sm text-grey-dim">{formatPublicDate(article.publishedAt, other)}</span>
      </Link>

      <p className="flex flex-wrap items-center justify-center gap-6">
        <Link
          href={href}
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
