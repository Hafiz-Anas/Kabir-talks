import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/articles/article-card";
import { LoadMore } from "@/components/articles/load-more";
import { TrendingList } from "@/components/articles/trending-list";
import { newsletterLabels } from "@/components/newsletter/labels";
import { SignupBox } from "@/components/newsletter/signup-box";
import { OpinionStrip } from "@/components/opinion/opinion-strip";
import { WhatsAppBand } from "@/components/social/follow-box";
import { LatestVideos } from "@/components/youtube/latest-videos";
import { JsonLdScript } from "@/components/json-ld";
import { SectionHeading } from "@/components/section-heading";
import { cardLabels, type Dictionary, getDictionary, isLocale, type Locale } from "@/i18n";
import { type ArticleCardData, FEED_PAGE_SIZE, OPINION_CATEGORY_SLUG } from "@/lib/articles/public";
import { features } from "@/lib/features";
import { pageMetadata, siteIdentity, siteUrl } from "@/lib/seo";
import { socialEntries } from "@/lib/social";
import { organizationLd, websiteLd } from "@/lib/structured-data";
import { categoryPath } from "@/lib/urls";
import { listArticleCards, listPublicCategories } from "@/server/public/articles";
import { listTrending } from "@/server/public/trending";
import { getSocialLinks } from "@/server/settings";
import { getLatestVideos } from "@/server/youtube";

// Must stay fully static (cached reads only): this is where shared links land.
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}`,
    title: `${dict.site.name} — ${dict.home.title}`,
    absoluteTitle: true,
    description: dict.site.description,
  });
}

/** How many stories sit beside the hero, and per category section. */
const TOP_STORIES = 4;
const SECTION_SIZE = 4;
/** Phase 7C: opinion pieces in the homepage strip. */
const OPINION_SIZE = 4;

/**
 * Homepage. Fully prerendered from cached public reads; admin publishes
 * expire those caches, so new stories appear without a redeploy.
 *
 * Hero = newest featured story (or newest story). Top stories = the next
 * featured ones, topped up with the latest. The Latest feed excludes both.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const [featured, latest, categories, trending, social, youtube] = await Promise.all([
    listArticleCards({ locale, featuredOnly: true, limit: TOP_STORIES + 1 }),
    listArticleCards({ locale, limit: TOP_STORIES + 1 }),
    listPublicCategories(),
    listTrending(locale),
    getSocialLinks(),
    getLatestVideos(),
  ]);

  if (latest.length === 0) return <EmptyHome dict={dict} />;

  const lead: ArticleCardData[] = [];
  for (const card of [...featured, ...latest]) {
    if (lead.length > TOP_STORIES) break;
    if (!lead.some((existing) => existing.id === card.id)) lead.push(card);
  }
  const [hero, ...topStories] = lead;
  const leadIds = lead.map((card) => card.id);

  // One extra card tells us whether "Load more" has anything to load.
  const [feedPage, sections, opinion] = await Promise.all([
    listArticleCards({ locale, excludeIds: leadIds, limit: FEED_PAGE_SIZE + 1 }),
    Promise.all(
      // Opinion has its own strip (author photos) instead of a plain section.
      categories.filter((category) => category.slug !== OPINION_CATEGORY_SLUG).map(async (category) => ({
        category,
        articles: await listArticleCards({ locale, categorySlug: category.slug, limit: SECTION_SIZE }),
      })),
    ).then((all) => all.filter((section) => section.articles.length > 0)),
    listArticleCards({ locale, categorySlug: OPINION_CATEGORY_SLUG, limit: OPINION_SIZE }),
  ]);
  const feed = feedPage.slice(0, FEED_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <JsonLdScript
        nodes={[organizationLd(siteIdentity(locale), socialEntries(social).map((entry) => entry.url)), websiteLd({ ...siteIdentity(locale), locale, searchUrl: siteUrl(`/${locale}/search`) })]}
      />
      <h1 className="sr-only">
        {dict.site.name} — {dict.home.title}
      </h1>

      <AdSlot placement="home-top" locale={locale} />

      <section aria-label={dict.home.topStories} className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <ArticleCard article={hero} locale={locale} labels={cardLabels(dict)} variant="large" priority headingLevel={2} />
        {topStories.length > 0 && (
          <div className="space-y-6 lg:border-s lg:border-border lg:ps-10">
            <h2 className="text-xs font-medium tracking-[0.14em] text-gold uppercase">{dict.home.topStories}</h2>
            <ul className="divide-y divide-border">
              {topStories.map((card) => (
                <li key={card.id} className="py-5 first:pt-0 last:pb-0">
                  <ArticleCard article={card} locale={locale} labels={cardLabels(dict)} variant="compact" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {feed.length > 0 && (
        <section aria-labelledby="latest">
          <SectionHeading id="latest" title={dict.home.latest} />
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((card) => (
              <ArticleCard key={card.id} article={card} locale={locale} labels={cardLabels(dict)} />
            ))}
          </div>
          {feedPage.length > FEED_PAGE_SIZE && (
            <LoadMore
              locale={locale}
              exclude={leadIds}
              initialOffset={FEED_PAGE_SIZE}
              labels={{ ...dict.home, ...cardLabels(dict) }}
            />
          )}
        </section>
      )}

      <WhatsAppBand url={social.whatsapp} labels={dict.social} />

      <OpinionStrip locale={locale} items={opinion} labels={{ title: dict.opinion.title, label: dict.opinion.label, viewAll: dict.common.viewAll }} />

      {youtube.channelId && (
        <LatestVideos
          videos={youtube.videos}
          labels={dict.videos}
          channelUrl={`https://www.youtube.com/channel/${youtube.channelId}`}
          newTab={dict.social.newTab}
        />
      )}

      <AdSlot placement="home-feed" locale={locale} />

      {(features.newsletterEnabled || trending.length > 0) && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <TrendingList locale={locale} items={trending} labels={{ title: dict.home.trendingTitle, description: dict.home.trendingDescription }} />
          {features.newsletterEnabled && <SignupBox locale={locale} labels={newsletterLabels(dict)} />}
        </div>
      )}

      {sections.map(({ category, articles }) => (
        <CategorySection key={category.id} locale={locale} dict={dict} category={category} articles={articles} />
      ))}
    </div>
  );
}

function CategorySection({
  locale,
  dict,
  category,
  articles,
}: {
  locale: Locale;
  dict: Dictionary;
  category: { slug: string; nameEn: string; nameUr: string };
  articles: ArticleCardData[];
}) {
  const id = `section-${category.slug}`;
  return (
    <section aria-labelledby={id}>
      <SectionHeading
        id={id}
        title={locale === "en" ? category.nameEn : category.nameUr}
        href={categoryPath(locale, category.slug)}
        linkLabel={dict.common.viewAll}
      />
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((card) => (
          <ArticleCard key={card.id} article={card} locale={locale} labels={cardLabels(dict)} />
        ))}
      </div>
    </section>
  );
}

function EmptyHome({ dict }: { dict: Dictionary }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6 sm:py-32">
      <span aria-hidden className="grid size-16 place-items-center border border-gold font-serif text-xl text-gold" lang="en">
        KT
      </span>
      <h1 className="text-4xl text-ivory sm:text-5xl">{dict.home.emptyTitle}</h1>
      <p className="text-lg text-grey">{dict.home.emptyDescription}</p>
    </div>
  );
}
