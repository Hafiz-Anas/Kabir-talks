import Link from "next/link";
import { locale as rootLocale } from "next/root-params";

import { defaultLocale, getDictionary, isLocale } from "@/i18n";

/** 404 inside the public site (keeps header/footer and the visitor's language). */
export default async function LocaleNotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6">
      <p className="font-serif text-6xl text-gold" lang="en">
        404
      </p>
      <h1 className="text-3xl text-ivory">{dict.notFound.title}</h1>
      <p className="text-grey">{dict.notFound.description}</p>
      <Link href={`/${locale}`} className="text-gold transition-colors hover:text-gold-soft">
        {dict.common.backHome}
      </Link>
    </div>
  );
}
