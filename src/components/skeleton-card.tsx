import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Placeholder article card. Replaced by real cards in Phase 4. */
export function SkeletonCard({
  size = "default",
  className,
}: {
  size?: "default" | "large";
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("space-y-3", className)}>
      <Skeleton
        className={cn(
          "w-full rounded-sm bg-obsidian-raised",
          size === "large" ? "aspect-[16/9]" : "aspect-[3/2]",
        )}
      />
      <Skeleton className="h-3 w-20 bg-obsidian-raised" />
      <Skeleton className={cn("bg-obsidian-raised", size === "large" ? "h-7 w-11/12" : "h-5 w-10/12")} />
      <Skeleton className={cn("bg-obsidian-raised", size === "large" ? "h-7 w-8/12" : "h-5 w-7/12")} />
      <Skeleton className="h-3 w-full bg-obsidian-raised" />
      <Skeleton className="h-3 w-9/12 bg-obsidian-raised" />
    </div>
  );
}
