import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Marks a feature that isn't available yet — either not built, or switched
 * off because its env key is missing (see src/lib/features.ts).
 *
 *   <ComingSoon label={dict.common.comingSoon} />                 inline badge
 *   <ComingSoon variant="panel" label={...} description={...} />  block placeholder
 */
export function ComingSoon({
  label = "Coming soon",
  description,
  variant = "badge",
  className,
}: {
  label?: string;
  description?: string;
  variant?: "badge" | "panel";
  className?: string;
}) {
  if (variant === "panel") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gold-muted/50 bg-obsidian px-6 py-12 text-center",
          className,
        )}
      >
        <ComingSoonBadge label={label} />
        {description && <p className="max-w-md text-sm text-grey">{description}</p>}
      </div>
    );
  }

  return <ComingSoonBadge label={label} className={className} />;
}

function ComingSoonBadge({ label, className }: { label: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm border-gold-muted bg-transparent px-2 text-[0.6875rem] font-medium tracking-wide text-gold uppercase",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
