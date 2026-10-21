"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { type ShareNetwork, shareUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

const NETWORKS: { id: ShareNetwork; name: string }[] = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "facebook", name: "Facebook" },
  { id: "x", name: "X" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "telegram", name: "Telegram" },
];

const noop = () => () => {};

/**
 * Copy link, the five share intents, and the device share sheet where the
 * browser supports it (mostly phones). Share intents are plain links, so they
 * work without JavaScript; copy and native share need it.
 */
export function ShareBar({
  url,
  title,
  labels,
  className,
}: {
  url: string;
  title: string;
  labels: { share: string; shareOn: string; copyLink: string; copied: string; nativeShare: string };
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // false on the server and during hydration, so the markup always matches.
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers / insecure contexts: fall back to a hidden textarea.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2500);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The reader closed the sheet — nothing to do.
    }
  }

  const item =
    "inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 text-sm text-ivory transition-colors hover:border-gold-muted hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label={labels.share}>
      {canShare && (
        <button type="button" onClick={nativeShare} className={cn(item, "border-gold-muted text-gold")}>
          <Share2 aria-hidden className="size-4" />
          {labels.nativeShare}
        </button>
      )}
      <button type="button" onClick={copy} className={item}>
        {copied ? <Check aria-hidden className="size-4 text-gold" /> : <Link2 aria-hidden className="size-4" />}
        {copied ? labels.copied : labels.copyLink}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? labels.copied : ""}
      </span>
      {NETWORKS.map((network) => (
        <a
          key={network.id}
          href={shareUrl(network.id, url, title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={labels.shareOn.replace("{network}", network.name)}
          className={item}
          lang="en"
          dir="ltr"
        >
          {network.name}
        </a>
      ))}
    </div>
  );
}
