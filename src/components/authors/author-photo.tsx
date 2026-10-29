import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * An author's photo in a circle, or their initial when there is no photo.
 * Decorative by default (the name is always written next to it).
 */
export function AuthorPhoto({
  name,
  photoUrl,
  size,
  priority = false,
  className,
}: {
  name: string;
  photoUrl: string | null;
  /** Rendered size in px. */
  size: number;
  priority?: boolean;
  className?: string;
}) {
  const box = cn("relative shrink-0 overflow-hidden rounded-full border border-gold-muted bg-obsidian-raised", className);
  if (photoUrl) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        <Image src={photoUrl} alt="" fill sizes={`${size}px`} priority={priority} className="object-cover" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(box, "grid place-items-center font-serif text-gold")} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
