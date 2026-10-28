import { THEME_SCRIPT } from "@/lib/theme";

import { ThemeSync } from "./theme-sync";

/**
 * Put inside <head> of every root layout. Applies the saved theme before the
 * first paint (no flash). Pair with <html suppressHydrationWarning>: the
 * script adds data-theme before React hydrates. The server never renders
 * data-theme (no attribute = the dark defaults on :root), so React never
 * resets it, even when it re-renders <html> on the client.
 */
export function ThemeScript() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <ThemeSync />
    </>
  );
}
