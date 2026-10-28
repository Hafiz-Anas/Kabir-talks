"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyThemePreference, readThemePreference, THEME_CHANGE_EVENT, THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type ThemeLabels = { label: string; dark: string; light: string; system: string };

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

/**
 * Sun/moon menu: Dark, Light or System. Reads and writes the browser's
 * localStorage only; the server renders "dark" and the inline head script
 * (lib/theme.ts) has already applied the real choice before the first paint.
 */
export function ThemeToggle({ labels, className }: { labels: ThemeLabels; className?: string }) {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readThemePreference, () => "dark");
  const Icon = ICONS[preference];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${labels.label}: ${labels[preference]}`}
          className={cn("text-grey hover:bg-transparent hover:text-gold-soft", className)}
        >
          <Icon aria-hidden className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 border-border bg-obsidian">
        <DropdownMenuLabel className="text-xs text-grey">{labels.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(value) => applyThemePreference(value as ThemePreference)}>
          {THEME_PREFERENCES.map((option) => {
            const OptionIcon = ICONS[option];
            return (
              <DropdownMenuRadioItem key={option} value={option} className="gap-2">
                <OptionIcon aria-hidden className="size-4" />
                {labels[option]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same choice as three buttons, for the mobile menu (the header toggle is hidden on phones). */
export function ThemeChoice({ labels }: { labels: ThemeLabels }) {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readThemePreference, () => "dark");
  return (
    <div role="group" aria-label={labels.label} className="grid grid-cols-3 gap-2">
      {THEME_PREFERENCES.map((option) => {
        const OptionIcon = ICONS[option];
        const active = preference === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => applyThemePreference(option)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-sm border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "border-gold bg-gold/10 text-gold" : "border-border text-ivory hover:border-gold-muted",
            )}
          >
            <OptionIcon aria-hidden className="size-4" />
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}
