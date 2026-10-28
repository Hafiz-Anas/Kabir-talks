"use client";

import { useLayoutEffect } from "react";

import { readThemePreference, resolveTheme } from "@/lib/theme";

/**
 * Safety net for the head script (lib/theme.ts): when React renders the
 * whole document in the browser (e.g. some error and not-found renders), it
 * neither runs inline scripts nor keeps attributes they added. This applies
 * the saved theme again before that render is painted.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-theme")) return;
    const theme = resolveTheme(readThemePreference());
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, []);
  return null;
}
