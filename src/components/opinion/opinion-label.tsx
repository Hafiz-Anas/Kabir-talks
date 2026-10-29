import { cn } from "@/lib/utils";

/** Phase 7C: the "Opinion" / "رائے" tag on opinion cards and articles. Gold outline, readable in both themes. */
export function OpinionLabel({ label, className }: { label: string; className?: string }) {
  return (
    <span
      data-opinion-label
      className={cn(
        "inline-block rounded-sm border border-gold px-1.5 py-0.5 text-[0.6875rem] leading-none font-semibold tracking-[0.14em] text-gold uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}
