"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { Locale } from "@/i18n/config";

/**
 * Lets a page tell the header's language switcher where the other language
 * lives, when that isn't simply "swap /en for /ur" — e.g. an article that
 * only exists in English sends the Urdu link to the Urdu homepage.
 *
 * The page renders <SetLocaleAlternates /> and the switcher reads the value
 * with useLocaleAlternate(). Entries are tied to the pathname that set them,
 * so a stale value can never leak onto another page.
 */

type Entry = { pathname: string; alternates: Partial<Record<Locale, string>> };

let current: Entry | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function SetLocaleAlternates({ pathname, alternates }: Entry) {
  useEffect(() => {
    const entry = { pathname, alternates };
    current = entry;
    emit();
    return () => {
      if (current === entry) {
        current = null;
        emit();
      }
    };
  }, [pathname, alternates]);
  return null;
}

export function useLocaleAlternate(pathname: string, target: Locale): string | undefined {
  const entry = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return entry?.pathname === pathname ? entry.alternates[target] : undefined;
}
