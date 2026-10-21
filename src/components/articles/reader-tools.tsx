import { Bookmark, Headphones, MessageCircleQuestion, Sparkles } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import type { Dictionary } from "@/i18n";

/**
 * Reader AI toolbar (Summarise, Ask, Listen) and Save. Placeholders only:
 * Phase 6 wires the AI tools (even if AI is configured now), Phase 5 adds
 * bookmarks. They are deliberately not buttons, so nothing looks clickable.
 */
export function ReaderTools({ dict }: { dict: Dictionary }) {
  const tools = [
    { label: dict.article.summarise, Icon: Sparkles },
    { label: dict.article.ask, Icon: MessageCircleQuestion },
    { label: dict.article.listen, Icon: Headphones },
    { label: dict.article.bookmark, Icon: Bookmark },
  ];

  return (
    <ul aria-label={dict.article.readerTools} className="flex flex-wrap gap-2">
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
