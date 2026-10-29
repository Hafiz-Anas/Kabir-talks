import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FollowBox } from "@/components/social/follow-box";
import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { getSocialLinks } from "@/server/settings";

/** About page. Copy lives in the i18n dictionaries (about.*) until there is a CMS page for it. */

// Must stay fully static (cached reads only): this is where shared links land.
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}/about`,
    // The title already names the site ("About Kabir Talks"), so skip the " · Kabir Talks" suffix.
    title: dict.about.title,
    absoluteTitle: true,
    description: dict.about.description,
  });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { about, social, site } = getDictionary(locale);
  const links = await getSocialLinks();

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
      <header className="kt-rule space-y-5 pt-6">
        <h1 className="text-4xl text-ivory sm:text-5xl">{about.title}</h1>
        <p className="text-xl text-grey">{about.lead}</p>
      </header>
      {about.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-2xl text-gold">{section.heading}</h2>
          <p className="text-lg text-ivory/90">{section.body}</p>
        </section>
      ))}
      <FollowBox links={links} labels={social} siteName={site.name} />
    </div>
  );
}
