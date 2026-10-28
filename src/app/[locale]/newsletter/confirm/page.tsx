import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TokenAction } from "@/components/newsletter/token-action";
import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";

/** Newsletter confirm link target. Static; the work happens in the browser (TokenAction). */
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/newsletter/confirm">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}/newsletter/confirm`,
    title: dict.newsletter.confirmTitle,
    description: dict.newsletter.description,
    noindex: true,
  });
}

export default async function NewsletterConfirmPage({ params }: PageProps<"/[locale]/newsletter/confirm">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="kt-rule pt-6 text-4xl text-ivory">{dict.newsletter.confirmTitle}</h1>
      <TokenAction
        action="confirm"
        locale={locale}
        labels={{
          working: dict.newsletter.confirming,
          done: dict.newsletter.confirmed,
          invalid: dict.newsletter.confirmInvalid,
          noToken: dict.newsletter.noToken,
          backHome: dict.common.backHome,
        }}
      />
    </div>
  );
}
