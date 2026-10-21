import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";

/** About page. Copy lives in the i18n dictionaries (about.*) until there is a CMS page for it. */

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: `/${locale}/about`, title: dict.about.title, description: dict.about.description });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { about } = getDictionary(locale);

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
    </div>
  );
}
