"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { fill } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { BREAKING_DISMISSED_KEY, type PublicBreakingItem } from "@/lib/breaking";

export type BreakingLabels = { label: string; region: string; dismiss: string; previous: string; next: string; position: string };

/** Seconds each item stays before the next one (only with several items, no hover/focus, motion allowed). */
const ROTATE_MS = 7000;
/** Matches the slide transition below. */
const SLIDE_MS = 300;

function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(BREAKING_DISMISSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(id: string) {
  try {
    const next = [...readDismissed().filter((existing) => existing !== id), id].slice(-50);
    localStorage.setItem(BREAKING_DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: dismissing still works for this page view.
  }
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/**
 * Phase 7C: the slim "Breaking" bar under the header. Pages stay static: the
 * live items load here, in the browser, from a 30-second cached endpoint. No
 * space is reserved until there is something to show; the bar then slides
 * open (instantly with reduced motion). Several items rotate gently, pausing
 * on hover or focus; with reduced motion they don't rotate on their own
 * (the arrows still work). Dismissed items are remembered per browser.
 * Never shown on account pages (and the admin has its own layout).
 */
export function BreakingBar({ locale, labels }: { locale: Locale; labels: BreakingLabels }) {
  const pathname = usePathname();
  const hidden = pathname === `/${locale}/account` || pathname.startsWith(`/${locale}/account/`);
  const [items, setItems] = useState<PublicBreakingItem[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    fetch(`/api/public/breaking?locale=${locale}`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items?: PublicBreakingItem[] }) => {
        if (cancelled) return;
        const dismissed = new Set(readDismissed());
        const live = (data.items ?? []).filter((item) => !dismissed.has(item.id));
        setItems(live);
        setIndex(0);
        // Open on the next frame, so the 0 → full height change animates.
        if (live.length) requestAnimationFrame(() => !cancelled && setOpen(true));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale, hidden]);

  const count = items.length;
  const rotating = count > 1 && !paused && !reducedMotion && open;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, count]);

  if (hidden || count === 0) return null;
  const current = items[Math.min(index, count - 1)];

  function dismiss() {
    saveDismissed(current.id);
    if (count === 1) {
      setOpen(false);
      window.setTimeout(() => setItems([]), reducedMotion ? 0 : SLIDE_MS);
      return;
    }
    setItems((list) => list.filter((item) => item.id !== current.id));
    setIndex((value) => (value >= count - 1 ? 0 : value));
  }

  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);
  const iconButton =
    "grid size-8 shrink-0 place-items-center rounded-sm text-grey transition-colors hover:text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <div
      data-breaking-bar
      data-open={open ? "true" : "false"}
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <section
          role="region"
          aria-label={labels.region}
          className="border-b border-border bg-obsidian"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
          }}
        >
          <div className="mx-auto flex min-h-11 max-w-6xl items-center gap-3 px-4 py-1.5 sm:px-6 lg:px-8">
            <span className="shrink-0 rounded-sm bg-breaking px-2 py-0.5 text-xs font-semibold tracking-[0.12em] text-white uppercase">
              {labels.label}
            </span>
            <p
              key={current.id}
              data-breaking-id={current.id}
              className="min-w-0 flex-1 text-sm text-ivory animate-in fade-in duration-500 motion-reduce:animate-none"
            >
              {current.href ? (
                <BreakingLink href={current.href} className="line-clamp-2 underline-offset-4 hover:text-gold-soft hover:underline focus-visible:underline focus-visible:outline-none">
                  {current.text}
                </BreakingLink>
              ) : (
                <span className="line-clamp-2">{current.text}</span>
              )}
            </p>
            {count > 1 && (
              <div className="flex shrink-0 items-center">
                <button type="button" className={iconButton} aria-label={labels.previous} onClick={() => step(-1)}>
                  <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
                </button>
                <span className="hidden text-xs text-grey tabular-nums sm:inline">
                  {fill(labels.position, { index: Math.min(index, count - 1) + 1, total: count })}
                </span>
                <button type="button" className={iconButton} aria-label={labels.next} onClick={() => step(1)}>
                  <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
                </button>
              </div>
            )}
            <button type="button" className={iconButton} aria-label={labels.dismiss} onClick={dismiss}>
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Internal links use the router; outside links open in a new tab. */
function BreakingLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
