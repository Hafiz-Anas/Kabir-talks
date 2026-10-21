import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/articles/article-card";
import { SectionHeading } from "@/components/section-heading";
import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { listArticleCards } from "@/server/public/articles";

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

/** Homepage: latest published stories in this language. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const latest = await listArticleCards({ locale, limit: 12 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="sr-only">{dict.site.name}</h1>
      <section aria-labelledby="latest">
        <SectionHeading id="latest" title={dict.home.latest} />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} labels={dict.common} />
          ))}
        </div>
      </section>
    </div>
  );
}
