import { renderDocToHtml } from "@/lib/content/render";
import { cn } from "@/lib/utils";
import { imagePrefix } from "@/server/storage";

/**
 * Server component that renders a stored Tiptap document with the shared
 * renderer. The HTML comes only from renderDocToHtml, which re-sanitizes
 * and escapes everything — raw database HTML is never output.
 * Reused by the admin preview now and public article pages in Phase 4.
 */
export function ArticleBody({ doc, locale, className }: { doc: unknown; locale: "en" | "ur"; className?: string }) {
  const html = renderDocToHtml(doc, { imagePrefix: imagePrefix() });
  return (
    <div
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className={cn("kt-prose", locale === "ur" && "font-urdu", className)}
      // Safe: output of the sanitizing renderer only.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
