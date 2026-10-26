import { Headphones, type LucideIcon, MessageCircleQuestion, Sparkles } from "lucide-react";

import { BookmarkButton } from "@/components/bookmarks/bookmark-button";
import { ComingSoon } from "@/components/coming-soon";
import { readerAiLabels } from "@/components/reader-ai/labels";
import { ReaderAiTools } from "@/components/reader-ai/reader-ai-tools";
import type { Dictionary, Locale } from "@/i18n";
import { features } from "@/lib/features";

/**
 * Reader toolbar: Save, and the AI tools (Summarise, Ask, Listen).
 * Without AI configured (features.aiEnabled) the AI tools stay "Coming soon"
 * placeholders, deliberately not buttons, so nothing looks clickable. With
 * AI, <ReaderAiTools /> loads each feature in the browser on click; the page
 * itself stays static. Save is the real bookmark button (state loaded in the
 * browser).
 */
export function ReaderTools({
  articleId,
  locale,
  dict,
  hasAudio = false,
}: {
  articleId: string;
  locale: Locale;
  dict: Dictionary;
  /** Current generated "Listen" audio exists for this language. */
  hasAudio?: boolean;
}) {
  const bookmark = <BookmarkButton articleId={articleId} locale={locale} labels={dict.bookmarks} variant="tool" />;
  const comingSoon = (label: string, Icon: LucideIcon) => (
    <li
      key={label}
      className="inline-flex h-9 items-center gap-2 rounded-sm border border-dashed border-border px-3 text-sm text-grey"
    >
      <Icon aria-hidden className="size-4 text-gold-muted" />
      {label}
      <ComingSoon label={dict.common.comingSoon} className="px-1.5 text-[0.625rem]" />
    </li>
  );

  if (features.aiEnabled) {
    return (
      <ReaderAiTools
        articleId={articleId}
        locale={locale}
        labels={readerAiLabels(dict)}
        bookmark={bookmark}
        hasAudio={hasAudio}
      />
    );
  }

  return (
    <ul aria-label={dict.article.readerTools} className="flex flex-wrap items-center gap-2">
      <li className="flex flex-col gap-1">{bookmark}</li>
      {comingSoon(dict.article.summarise, Sparkles)}
      {comingSoon(dict.article.ask, MessageCircleQuestion)}
      {comingSoon(dict.article.listen, Headphones)}
    </ul>
  );
}
