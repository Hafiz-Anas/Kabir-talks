import Link from "next/link";

import type { Dictionary, Locale } from "@/i18n";

/** The public 404 body (keeps header/footer and the visitor's language). */
export function NotFoundMessage({ locale, dict }: { locale: Locale; dict: Dictionary }) {
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
