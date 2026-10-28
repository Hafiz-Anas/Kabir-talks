import { locale as rootLocale } from "next/root-params";

import { OtherLanguageNotice } from "@/components/articles/other-language-notice";
import { NotFoundMessage } from "@/components/not-found-message";
import { defaultLocale, getDictionary, isLocale } from "@/i18n";

/**
 * 404 for article URLs. When the article is published but only in the other
 * language, says so and links to it ("This article is only available in
 * English"); otherwise the usual 404. Status stays 404 and the page is noindex.
 */
export default async function ArticleNotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  const dict = getDictionary(locale);
  return (
    // data-no-ads: AdsLoader never loads ads on error pages.
    <div data-no-ads>
      <OtherLanguageNotice
        locale={locale}
        dict={{ article: dict.article, languageName: dict.languageName, common: dict.common }}
        fallback={<NotFoundMessage locale={locale} dict={dict} />}
      />
    </div>
  );
}
