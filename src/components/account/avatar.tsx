import { safeAvatarSrc, storagePublicPrefix } from "@/lib/content/urls";
import { cn } from "@/lib/utils";

/**
 * Reader avatar: their photo when it comes from an allowed source (our
 * bucket or Google, see safeAvatarSrc), otherwise their initials on a
 * colour picked from the name. Hook-free, so it renders on server and client.
 * A deleted user (no name) gets a neutral silhouette-like dot.
 */

const STORAGE_PREFIX = storagePublicPrefix(process.env.NEXT_PUBLIC_SUPABASE_URL);

const TONES = [
  "bg-[#3a3326] text-gold-soft",
  "bg-[#25302c] text-[#b9d4c4]",
  "bg-[#2b2a36] text-[#c9c4e6]",
  "bg-[#352628] text-[#e6c1c4]",
  "bg-[#24303a] text-[#bcd2e6]",
];

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)!] : words;
  return letters.map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? "").join("");
}

function tone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return TONES[hash % TONES.length];
}

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  /** Null for a deleted user. */
  name: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const src = name ? safeAvatarSrc(image, STORAGE_PREFIX) : null;
  const box = size === "lg" ? "size-20 text-2xl" : size === "sm" ? "size-8 text-xs" : "size-9 text-sm";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny, from an allow-listed host; next/image would need Google's host configured
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        className={cn("shrink-0 rounded-full object-cover", box, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-medium select-none",
        name ? tone(name) : "bg-obsidian-raised text-grey-dim",
        box,
        className,
      )}
    >
      {name ? initials(name) : "?"}
    </span>
  );
}
