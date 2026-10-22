import { Headphones, MessageCircleQuestion, Sparkles } from "lucide-react";

import { BookmarkButton } from "@/components/bookmarks/bookmark-button";
import { ComingSoon } from "@/components/coming-soon";
import type { Dictionary, Locale } from "@/i18n";

/**
 * Reader toolbar: AI tools (Summarise, Ask, Listen) and Save.
 * The AI tools are placeholders until Phase 6 (even if AI is configured now)
 * and deliberately not buttons, so nothing looks clickable. Save is the real
 * bookmark button (state loaded in the browser).
 */
export function ReaderTools({ articleId, locale, dict }: { articleId: string; locale: Locale; dict: Dictionary }) {
  const tools = [
    { label: dict.article.summarise, Icon: Sparkles },
    { label: dict.article.ask, Icon: MessageCircleQuestion },
    { label: dict.article.listen, Icon: Headphones },
  ];

  return (
    <ul aria-label={dict.article.readerTools} className="flex flex-wrap items-center gap-2">
      <li className="flex flex-col gap-1">
        <BookmarkButton articleId={articleId} locale={locale} labels={dict.bookmarks} variant="tool" />
      </li>
      {tools.map(({ label, Icon }) => (
        <li
          key={label}
          className="inline-flex h-9 items-center gap-2 rounded-sm border border-dashed border-border px-3 text-sm text-grey"
        >
          <Icon aria-hidden className="size-4 text-gold-muted" />
          {label}
          <ComingSoon label={dict.common.comingSoon} className="px-1.5 text-[0.625rem]" />
        </li>
      ))}
    </ul>
  );
}
