import { cn } from "@/lib/utils";

export type CommentStatus = "PENDING" | "APPROVED" | "REJECTED";

const STYLES: Record<CommentStatus, string> = {
  PENDING: "border-gold-muted bg-gold/10 text-gold",
  APPROVED: "border-success/40 bg-success/10 text-success",
  REJECTED: "border-destructive/40 bg-destructive/10 text-danger",
};

/** Comment moderation state, for the reader's "My comments" list and the admin queue. */
export function CommentStatusBadge({ status, label, className }: { status: CommentStatus; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
