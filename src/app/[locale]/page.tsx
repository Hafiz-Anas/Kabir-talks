import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/coming-soon";
import { SectionHeading } from "@/components/section-heading";
import { SkeletonCard } from "@/components/skeleton-card";
import { getDictionary, isLocale } from "@/i18n";

/** Homepage shell. Real stories replace the skeletons in Phase 4. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const comingSoon = <ComingSoon label={dict.common.comingSoon} />;

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <section aria-labelledby="featured">
        <SectionHeading id="featured" title={dict.home.featured} aside={comingSoon} />
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <SkeletonCard size="large" />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
            <SkeletonCard />
            <SkeletonCard className="hidden sm:block" />
          </div>
        </div>
      </section>

      <section aria-labelledby="latest">
        <SectionHeading id="latest" title={dict.home.latest} aside={comingSoon} />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} className={i > 1 ? "hidden sm:block" : undefined} />
          ))}
        </div>
      </section>

      <div className="grid gap-14 lg:grid-cols-2 lg:gap-10">
        <section aria-labelledby="current-affairs">
          <SectionHeading
            id="current-affairs"
            title={dict.home.currentAffairs}
            href={`/${locale}/current-affairs`}
            linkLabel={dict.common.viewAll}
          />
          <div className="grid gap-8 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>

        <section aria-labelledby="sports">
          <SectionHeading
            id="sports"
            title={dict.home.sports}
            href={`/${locale}/sports`}
            linkLabel={dict.common.viewAll}
          />
          <div className="grid gap-8 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
      </div>
    </div>
  );
}
