import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleListing } from "@/components/articles/article-listing";
import { AuthorPhoto } from "@/components/authors/author-photo";
import { JsonLdScript } from "@/components/json-ld";
import { SocialLinksRow } from "@/components/social/social-icons";
import { fill, getDictionary, isLocale } from "@/i18n";
import { LISTING_PAGE_SIZE, parsePageParam } from "@/lib/articles/public";
import { authorPath, localizeAuthor } from "@/lib/authors";
import { metaDescription, pageMetadata, siteIdentity, siteUrl } from "@/lib/seo";
import { socialEntries } from "@/lib/social";
import { breadcrumbLd, profilePageLd } from "@/lib/structured-data";
import { listingPagePath } from "@/lib/urls";

import { countArticles, listArticleCards } from "./articles";
import { getPublicAuthor, listPublicAuthorSlugs } from "./authors";

/**
 * Author pages (Phase 7C): /{locale}/author/{slug} and later pages
 * (?page=N, rewritten by src/proxy.ts to /{locale}/author/{slug}/p/N).
 * Static like the section and tag pages: cached reads only, real 404s.
 */

type RawParams = { locale: string; slug: string; page?: string };

async function resolve(raw: RawParams) {
  const page = parsePageParam(raw.page);
  if (!isLocale(raw.locale) || page === null || (raw.page !== undefined && page === 1)) notFound();
  const locale = raw.locale;
  const row = await getPublicAuthor(raw.slug);
  if (!row) notFound();
  const total = await countArticles({ locale, authorId: row.id });
  const pages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (page > pages) notFound();
  return { locale, page, pages, author: localizeAuthor(row, locale), basePath: authorPath(locale, row.slug) };
}

export async function authorMetadata(raw: RawParams): Promise<Metadata> {
  const { locale, page, author, basePath } = await resolve(raw);
  const dict = getDictionary(locale);
  const suffix = page > 1 ? ` — ${fill(dict.listing.page, { page })}` : "";
  return pageMetadata({
    locale,
    path: listingPagePath(basePath, page),
    title: author.name + suffix,
    description: metaDescription(author.bio, fill(dict.author.description, { name: author.name })),
  });
}

export async function AuthorPage({ raw }: { raw: RawParams }) {
  const { locale, page, pages, author, basePath } = await resolve(raw);
  const dict = getDictionary(locale);
  const articles = await listArticleCards({
    locale,
    authorId: author.id,
    limit: LISTING_PAGE_SIZE,
    offset: (page - 1) * LISTING_PAGE_SIZE,
  });
  const name = author.nameIsEnglish ? <bdi lang="en">{author.name}</bdi> : author.name;

  return (
    <>
      <JsonLdScript
        nodes={[
          profilePageLd({
            url: siteUrl(basePath),
            name: author.name,
            jobTitle: author.title,
            description: author.bio,
            image: author.photoUrl,
            sameAs: socialEntries(author.socialLinks).map((entry) => entry.url),
            locale,
            site: siteIdentity(locale),
          }),
          breadcrumbLd([
            { name: dict.nav.home, url: siteUrl(`/${locale}`) },
            { name: author.name, url: siteUrl(basePath) },
          ]),
        ]}
      />
      <ArticleListing
        locale={locale}
        dict={dict}
        heading={name}
        header={
          <header className="kt-rule flex max-w-3xl flex-col gap-5 pt-6 sm:flex-row sm:items-start sm:gap-8" data-author-header>
            <AuthorPhoto name={author.name} photoUrl={author.photoUrl} size={112} priority />
            <div className="min-w-0 space-y-3">
              <p className="text-xs font-medium tracking-[0.12em] text-gold uppercase">{dict.author.label}</p>
              <h1 className="text-4xl text-ivory sm:text-5xl">{name}</h1>
              {author.title && <p className="text-lg text-grey">{author.title}</p>}
              {author.bio && <p className="text-lg text-ivory/90">{author.bio}</p>}
              <SocialLinksRow links={author.socialLinks} owner={author.name} labels={dict.social} className="pt-1" />
            </div>
          </header>
        }
        listHeading={fill(dict.author.articlesBy, { name: author.name })}
        articles={articles}
        page={page}
        pages={pages}
        basePath={basePath}
        emptyText={dict.author.empty}
      />
    </>
  );
}

export async function authorSlugParams() {
  const slugs = await listPublicAuthorSlugs();
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ authorSlug: slug }));
}

/** Pages 2..n that exist now, for each author. */
export async function authorPagedParams(locale: string) {
  const out: { authorSlug: string; page: string }[] = [];
  if (isLocale(locale)) {
    for (const slug of await listPublicAuthorSlugs()) {
      const author = await getPublicAuthor(slug);
      if (!author) continue;
      const total = await countArticles({ locale, authorId: author.id });
      for (let page = 2; page <= Math.ceil(total / LISTING_PAGE_SIZE); page++) out.push({ authorSlug: slug, page: String(page) });
    }
  }
  return out.length ? out : [{ authorSlug: "__none__", page: "2" }];
}
