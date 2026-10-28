import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactForm } from "@/components/contact-form";
import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { getContactEmail } from "@/server/settings";

/** Contact page (Phase 7). Static: the form posts to /api/contact from the browser. */
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({ locale, path: `/${locale}/contact`, title: dict.contact.title, description: dict.contact.description });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const email = await getContactEmail();

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="kt-rule space-y-4 pt-6">
        <h1 className="text-4xl text-ivory sm:text-5xl">{dict.contact.title}</h1>
        <p className="text-lg text-grey">{dict.contact.intro}</p>
        {email && (
          <p className="text-grey">
            {dict.contact.emailUs}{" "}
            <a href={`mailto:${email}`} dir="ltr" className="text-gold underline underline-offset-4 hover:text-gold-soft">
              {email}
            </a>
          </p>
        )}
      </header>
      <ContactForm locale={locale} labels={dict.contact} />
    </div>
  );
}
