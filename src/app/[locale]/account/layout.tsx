import { notFound } from "next/navigation";

import { AccountNav } from "@/components/account/account-nav";
import { getDictionary, isLocale } from "@/i18n";

/** Shared frame for the private account pages (each page checks the session itself). */
export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { nav, account } = getDictionary(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <AccountNav locale={locale} labels={{ account: nav.myAccount, bookmarks: nav.myBookmarks, nav: account.title }} />
      {children}
    </div>
  );
}
