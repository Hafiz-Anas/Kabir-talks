import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/articles/article-card";
import { AuthorBox } from "@/components/authors/author-box";
import { ReaderTools } from "@/components/articles/reader-tools";
import { ReadingProgress } from "@/components/articles/reading-progress";
import { ShareBar } from "@/components/articles/share-bar";
import { TrendingList } from "@/components/articles/trending-list";
import { ViewBeacon } from "@/components/articles/view-beacon";
import { Breadcrumb } from "@/components/breadcrumb";
import { CommentCount } from "@/components/comments/comment-count";
import { LazyComments } from "@/components/comments/lazy-comments";
import { ArticleBody } from "@/components/content/article-body";
import { JsonLdScript } from "@/components/json-ld";
import { newsletterLabels } from "@/components/newsletter/labels";
import { SignupBox } from "@/components/newsletter/signup-box";
import { SetLocaleAlternates } from "@/components/layout/locale-alternates";
import { cardLabels, fill, getDictionary, isLocale, type Locale, locales } from "@/i18n";
import { significantUpdate, tagName } from "@/lib/articles/public";
import { authorPath } from "@/lib/authors";
import { features } from "@/lib/features";
import { docToPlainText } from "@/lib/content/document";
import { formatPublicDate } from "@/lib/format";
import { articleShareImage, metaDescription, pageMetadata, siteIdentity, siteUrl } from "@/lib/seo";
import { breadcrumbLd, newsArticleLd } from "@/lib/structured-data";
import { articlePath, categoryPath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { getPublishedArticle, listArticleStaticParams, listRelatedArticles } from "@/server/public/articles";
import { listTrending } from "@/server/public/trending";

/**
 * Article page. Prerendered for every published (locale, article) pair at
 * build time; newer articles render on their first request. `ensureStatic =
 * 'navigation'` keeps the whole page static (cached reads only), so that first
 * request waits for the complete render — which is what lets these return a
 * real status instead of a streamed 200:
 *
 *  - Draft/archived/unknown slug → 404 (public reads only see PUBLISHED).
 *  - Old category in the URL → 308 to the current URL.
 *  - Exists only in the other language → 404 with a friendly link
 *    (./not-found.tsx).
 */
export const ensureStatic = "navigation";
// Navigations wait for the (static) page rather than showing a loading shell; also
// silences the dev-only instant-navigation check for awaiting params.
export const instant = false;

// Called once per locale (from the [locale] layout). Returns both segments:
// the section page's own generateStaticParams doesn't feed child segments.
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const list = (await listArticleStaticParams())
    .filter((entry) => entry.locale === params.locale)
    .map(({ categorySlug, articleSlug }) => ({ categorySlug, articleSlug }));
  // Cache Components needs at least one param; the placeholder simply 404s.
  return list.length ? list : [{ categorySlug: "__none__", articleSlug: "__none__" }];
}

type Params = PageProps<"/[locale]/[categorySlug]/[articleSlug]">["params"];

async function load(params: Params) {
  const { locale, categorySlug, articleSlug } = await params;
  if (!isLocale(locale)) notFound();
  const article = await getPublishedArticle(articleSlug);
  if (!article) notFound();
  if (article.categorySlug !== categorySlug) permanentRedirect(articlePath(locale, article.categorySlug, article.slug));
  const content = article.locales[locale];
  if (!content) notFound();
  return { locale, article, content };
}

/** Paths of the versions that exist, by locale. */
function availablePaths(article: Awaited<ReturnType<typeof load>>["article"]) {
  return Object.fromEntries(
    locales.filter((l) => article.locales[l]).map((l) => [l, articlePath(l, article.categorySlug, article.slug)]),
  ) as Partial<Record<Locale, string>>;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[categorySlug]/[articleSlug]">): Promise<Metadata> {
  const { locale, article, content } = await load(params);
  const dict = getDictionary(locale);
  const section = locale === "en" ? article.categoryNameEn : article.categoryNameUr;

  return pageMetadata({
    locale,
    path: articlePath(locale, article.categorySlug, article.slug),
    title: content.seoTitle ?? content.title,
    description: metaDescription(content.seoDescription ?? content.excerpt ?? docToPlainText(content.body), dict.site.description),
    languages: availablePaths(article),
    image: articleShareImage(locale, article.slug, article.updatedAt, article.coverImageAlt?.trim() || content.title),
    article: {
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      section,
      tags: article.tags.map((tag) => tagName(tag, locale)),
    },
  });
}

export default async function ArticlePage({ params }: PageProps<"/[locale]/[categorySlug]/[articleSlug]">) {
  const { locale, article, content } = await load(params);
  const dict = getDictionary(locale);
  const path = articlePath(locale, article.categorySlug, article.slug);
  const section = locale === "en" ? article.categoryNameEn : article.categoryNameUr;
  const [related, trending] = await Promise.all([listRelatedArticles(article.id, locale), listTrending(locale, { excludeId: article.id })]);
  const updated = significantUpdate(article.publishedAt, article.updatedAt);
  const other = locales.find((l) => l !== locale)!;
  const author = article.author[locale];
  const authorName = author.nameIsEnglish ? <bdi lang="en">{author.name}</bdi> : author.name;

  return (
    <>
      <JsonLdScript
        nodes={[
          newsArticleLd({
            url: siteUrl(path),
            headline: content.title,
            description: content.seoDescription ?? content.excerpt,
            images: [
              ...(article.coverImageUrl ? [article.coverImageUrl] : []),
              articleShareImage(locale, article.slug, article.updatedAt, content.title).url,
            ],
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            locale,
            section,
            keywords: article.tags.map((tag) => tagName(tag, locale)),
            author: { name: author.name, url: siteUrl(authorPath(locale, author.slug)) },
            site: siteIdentity(locale),
          }),
          breadcrumbLd([
            { name: dict.nav.home, url: siteUrl(`/${locale}`) },
            { name: section, url: siteUrl(categoryPath(locale, article.categorySlug)) },
            { name: content.title, url: siteUrl(path) },
          ]),
        ]}
      />
      <ReadingProgress targetId="article-body" label={dict.article.progress} />
      <ViewBeacon articleId={article.id} />
      <SetLocaleAlternates
        pathname={path}
        alternates={{ [other]: article.locales[other] ? articlePath(other, article.categorySlug, article.slug) : `/${other}` }}
      />

      <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className={cn(trending.length > 0 && "lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]")}>
          <div className="min-w-0">
            <header className="mx-auto max-w-3xl space-y-5">
              <Breadcrumb
                label={dict.nav.breadcrumb}
                items={[
                  { href: `/${locale}`, label: dict.nav.home },
                  { href: categoryPath(locale, article.categorySlug), label: section },
                ]}
              />
              <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
                <Link href={categoryPath(locale, article.categorySlug)} className="hover:text-gold-soft">
                  {section}
                </Link>
              </p>
              <h1 className="text-4xl text-ivory sm:text-5xl lg:text-[3.25rem]">{content.title}</h1>
              {content.excerpt && <p className="text-xl text-grey sm:text-2xl/relaxed">{content.excerpt}</p>}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-border py-4 text-sm text-grey">
                <span data-byline>
                  {dict.article.by}{" "}
                  <Link href={authorPath(locale, author.slug)} rel="author" className="text-ivory underline-offset-4 hover:text-gold-soft hover:underline">
                    {authorName}
                  </Link>
                </span>
                <span aria-hidden className="text-grey-dim">·</span>
                <span>
                  <span className="sr-only">{dict.article.published} </span>
                  <time dateTime={article.publishedAt}>{formatPublicDate(article.publishedAt, locale)}</time>
                </span>
                {updated && (
                  <>
                    <span aria-hidden className="text-grey-dim">·</span>
                    <span>
                      {dict.article.updated} <time dateTime={article.updatedAt}>{formatPublicDate(article.updatedAt, locale)}</time>
                    </span>
                  </>
                )}
                <span aria-hidden className="text-grey-dim">·</span>
                <span>{fill(dict.common.minRead, { minutes: content.readingMinutes })}</span>
                <span aria-hidden className="text-grey-dim">·</span>
                <CommentCount articleId={article.id} labels={dict.comments} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <ReaderTools articleId={article.id} locale={locale} dict={dict} hasAudio={content.hasAudio} />
              </div>
              <ShareBar url={siteUrl(path)} title={content.title} labels={dict.article} />
            </header>

            <AdSlot placement="article-top" locale={locale} />

            {article.coverImageUrl && (
              <figure className="mx-auto mt-10 max-w-4xl">
                <Image
                  src={article.coverImageUrl}
                  alt={article.coverImageAlt ?? ""}
                  width={1600}
                  height={900}
                  sizes="(min-width: 1024px) 896px, 100vw"
                  priority
                  className="aspect-video w-full rounded-sm object-cover"
                />
              </figure>
            )}

            <div id="article-body" className="mx-auto mt-10 max-w-3xl space-y-12">
              <ArticleBody
                doc={content.body}
                locale={locale}
                className="kt-article-body"
                inline={<AdSlot placement="article-inline" locale={locale} />}
              />

              {article.tags.length > 0 && (
                <section aria-labelledby="article-tags" className="space-y-3">
                  <h2 id="article-tags" className="text-sm font-medium tracking-[0.12em] text-gold uppercase">
                    {dict.article.tags}
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {article.tags.map((tag) => (
                      <li key={tag.id}>
                        <Link
                          href={`/${locale}/tags/${tag.slug}`}
                          lang={locale === "ur" && !tag.nameUr ? "en" : undefined}
                          className="inline-block rounded-sm bg-obsidian-raised px-3 py-1.5 text-sm text-ivory transition-colors hover:bg-gold hover:text-black focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {tagName(tag, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <AuthorBox author={author} locale={locale} labels={dict.author} socialLabels={dict.social} />

              <section aria-labelledby="share-bottom" className="space-y-3 border-t border-border pt-8">
                <h2 id="share-bottom" className="text-lg text-ivory">
                  {dict.article.share}
                </h2>
                <ShareBar url={siteUrl(path)} title={content.title} labels={dict.article} />
              </section>

              {features.newsletterEnabled && <SignupBox locale={locale} labels={newsletterLabels(dict)} variant="inline" />}

              <AdSlot placement="article-bottom" locale={locale} />

              <section aria-labelledby="comments" className="space-y-4">
                <h2 id="comments" className="scroll-mt-28 text-2xl text-ivory">
                  {dict.article.comments}
                </h2>
                {/* Loaded in the browser when scrolled near, so moderation never needs a page rebuild. */}
                <LazyComments
                  articleId={article.id}
                  locale={locale}
                  labels={{ ...dict.comments, signIn: dict.bookmarks.signIn, signUp: dict.bookmarks.signUp, adminBadge: dict.site.name }}
                />
              </section>
            </div>
          </div>
          {trending.length > 0 && (
            <aside aria-label={dict.home.trendingTitle} className="mt-16 border-t border-border pt-8 lg:mt-0 lg:border-t-0 lg:pt-0">
              <div className="lg:sticky lg:top-28">
                <TrendingList
                  locale={locale}
                  items={trending}
                  labels={{ title: dict.home.trendingTitle, description: dict.home.trendingDescription }}
                  variant="sidebar"
                />
              </div>
            </aside>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related" className="border-t border-border bg-obsidian">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 id="related" className="kt-rule mb-8 pt-4 text-2xl text-ivory sm:text-3xl">
              {dict.article.related}
            </h2>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((card) => (
                <ArticleCard key={card.id} article={card} locale={locale} labels={cardLabels(dict)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
