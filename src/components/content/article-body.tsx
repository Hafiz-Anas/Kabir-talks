import type { ReactNode } from "react";

import { renderDocToHtml, renderDocToHtmlParts } from "@/lib/content/render";
import { cn } from "@/lib/utils";
import { imagePrefix } from "@/server/storage";

/**
 * Server component that renders a stored Tiptap document with the shared
 * renderer. The HTML comes only from renderDocToHtml / renderDocToHtmlParts,
 * which re-sanitize and escape everything — raw database HTML is never output.
 * Used by the admin preview and the public article page.
 *
 * `inline` places an element (the article-inline ad slot) after the
 * `inlineAfter`-th paragraph, between two renderer outputs.
 */
export function ArticleBody({
  doc,
  locale,
  className,
  inline,
  inlineAfter = 3,
}: {
  doc: unknown;
  locale: "en" | "ur";
  className?: string;
  inline?: ReactNode;
  inlineAfter?: number;
}) {
  const prose = {
    lang: locale,
    dir: locale === "ur" ? "rtl" : "ltr",
    className: cn("kt-prose", locale === "ur" && "font-urdu"),
  } as const;

  if (!inline) {
    const html = renderDocToHtml(doc, { imagePrefix: imagePrefix() });
    // Safe: output of the sanitizing renderer only.
    return <div {...prose} className={cn(prose.className, className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const [first, rest] = renderDocToHtmlParts(doc, { imagePrefix: imagePrefix() }, inlineAfter);
  return (
    <div className={className}>
      {/* Safe: both halves are output of the sanitizing renderer only. */}
      <div {...prose} dangerouslySetInnerHTML={{ __html: first }} />
      {rest && (
        <>
          {inline}
          <div {...prose} className={cn(prose.className, "mt-[1.1em]")} dangerouslySetInnerHTML={{ __html: rest }} />
        </>
      )}
    </div>
  );
}
