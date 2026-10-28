import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TokenAction } from "@/components/newsletter/token-action";
import { getDictionary, isLocale } from "@/i18n";
import { pageMetadata } from "@/lib/seo";

/** Newsletter unsubscribe link target. Static; the work happens in the browser (TokenAction). */
export const ensureStatic = "navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/newsletter/unsubscribe">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: `/${locale}/newsletter/unsubscribe`,
    title: dict.newsletter.unsubscribeTitle,
    description: dict.newsletter.description,
    noindex: true,
  });
}

export default async function NewsletterUnsubscribePage({ params }: PageProps<"/[locale]/newsletter/unsubscribe">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="kt-rule pt-6 text-4xl text-ivory">{dict.newsletter.unsubscribeTitle}</h1>
      <TokenAction
        action="unsubscribe"
        locale={locale}
        labels={{
          working: dict.newsletter.unsubscribing,
          done: dict.newsletter.unsubscribed,
          invalid: dict.newsletter.unsubscribeInvalid,
          noToken: dict.newsletter.noToken,
          after: dict.newsletter.resubscribe,
          backHome: dict.common.backHome,
        }}
      />
    </div>
  );
}
