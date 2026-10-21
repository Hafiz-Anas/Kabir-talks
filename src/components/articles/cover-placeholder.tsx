import { cn } from "@/lib/utils";

/** Branded stand-in for articles without a cover image: gold KT monogram on obsidian. */
export function CoverPlaceholder({ size = "medium", className }: { size?: "large" | "medium" | "compact"; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,rgb(201_165_76/0.16),transparent_65%)] bg-obsidian-raised",
        className,
      )}
    >
      <span
        lang="en"
        dir="ltr"
        className={cn(
          "grid place-items-center border border-gold-muted font-serif font-semibold tracking-[0.08em] text-gold-muted",
          size === "large" ? "size-20 text-2xl" : size === "compact" ? "size-9 text-xs" : "size-14 text-lg",
        )}
      >
        KT
      </span>
    </div>
  );
}
