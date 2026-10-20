import type { ArticleStatus } from "@/lib/articles/rules";
import { cn } from "@/lib/utils";

const STYLES: Record<ArticleStatus, { label: string; className: string }> = {
  PUBLISHED: { label: "Published", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  DRAFT: { label: "Draft", className: "border-gold-muted bg-gold/10 text-gold" },
  ARCHIVED: { label: "Archived", className: "border-border bg-obsidian-raised text-grey" },
};

export function StatusBadge({ status, className }: { status: ArticleStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
