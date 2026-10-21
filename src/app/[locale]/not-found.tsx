import { locale as rootLocale } from "next/root-params";

import { NotFoundMessage } from "@/components/not-found-message";
import { defaultLocale, getDictionary, isLocale } from "@/i18n";

/** 404 inside the public site (keeps header/footer and the visitor's language). */
export default async function LocaleNotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  return <NotFoundMessage locale={locale} dict={getDictionary(locale)} />;
}
