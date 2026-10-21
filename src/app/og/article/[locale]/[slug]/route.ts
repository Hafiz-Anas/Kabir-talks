import { cacheLife, cacheTag } from "next/cache";

import { isLocale, type Locale } from "@/i18n";
import { cacheTags } from "@/lib/cache-tags";
import { articleShareImageResponse } from "@/server/og/share-image";
import { getPublishedArticle } from "@/server/public/articles";

/**
 * GET /og/article/{locale}/{slug}[?v=…] — the article's 1200×630 share image.
 * 404 unless the article is published AND available in that locale, so a
 * draft's or archived article's image is never served. ?v= only busts the
 * caches of networks that store previews by URL; it doesn't change the output.
 */

async function renderPng(locale: Locale, slug: string): Promise<Uint8Array | null> {
  "use cache";
  cacheLife("days");
  cacheTag(cacheTags.articles);

  const article = await getPublishedArticle(slug);
  const content = article?.locales[locale];
  if (!article || !content) return null;
  const image = await articleShareImageResponse({
    locale,
    title: content.title,
    category: locale === "en" ? article.categoryNameEn : article.categoryNameUr,
    coverImageUrl: article.coverImageUrl,
  });
  return new Uint8Array(await image.arrayBuffer());
}

export async function GET(_request: Request, { params }: RouteContext<"/og/article/[locale]/[slug]">) {
  const { locale, slug } = await params;
  const png = isLocale(locale) ? await renderPng(locale, slug) : null;
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(png as BodyInit, {
    headers: {
      "content-type": "image/png",
      // Short CDN lifetime, so an unpublished article's image disappears quickly.
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
