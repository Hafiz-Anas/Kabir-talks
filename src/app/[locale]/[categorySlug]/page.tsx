import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/coming-soon";
import { SectionHeading } from "@/components/section-heading";
import { SkeletonCard } from "@/components/skeleton-card";
import { getDictionary, isLocale } from "@/i18n";
import { NAV_CATEGORIES } from "@/lib/navigation";

/**
 * Placeholder category page so header links and the language switcher can be
 * tested. Phase 4 replaces this with a database-driven listing.
 */

// Known slugs are prerendered; unknown ones may block while resolving to a 404.
// Phase 4 should revisit this once the listing streams real data.
export const instant = false;

export function generateStaticParams() {
  return NAV_CATEGORIES.map((category) => ({ categorySlug: category.slug }));
}

async function resolve(params: PageProps<"/[locale]/[categorySlug]">["params"]) {
  const { locale, categorySlug } = await params;
  const category = NAV_CATEGORIES.find((c) => c.slug === categorySlug);
  if (!isLocale(locale) || !category) notFound();
  const dict = getDictionary(locale);
  return { dict, title: dict.nav[category.labelKey] };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[categorySlug]">): Promise<Metadata> {
  const { title } = await resolve(params);
  return { title };
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/[categorySlug]">) {
  const { dict, title } = await resolve(params);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <SectionHeading title={title} aside={<ComingSoon label={dict.common.comingSoon} />} />
      <ComingSoon variant="panel" label={dict.common.comingSoon} description={dict.category.placeholder} />
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} className={i > 0 ? "hidden sm:block" : undefined} />
        ))}
      </div>
    </div>
  );
}
