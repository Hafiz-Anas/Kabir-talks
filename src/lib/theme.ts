/**
 * Dark / Light / System theme (Phase 7). The choice lives in the reader's
 * browser only (localStorage), never on the server, so every page stays
 * static and identical for everyone. Dark is the default brand look.
 */

export const THEME_STORAGE_KEY = "kt-theme";
export const THEME_PREFERENCES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "dark" | "light";

/**
 * Runs inline in <head>, before the first paint, so there is never a flash of
 * the wrong theme. Sets <html data-theme> and color-scheme, and follows the
 * operating system while "system" is chosen. Kept tiny and dependency-free.
 */
export const THEME_SCRIPT = `(function(){var k="${THEME_STORAGE_KEY}",d=document.documentElement,m=window.matchMedia&&matchMedia("(prefers-color-scheme: light)");function pref(){try{return localStorage.getItem(k)}catch(e){return null}}function apply(){var p=pref(),t=p==="light"?"light":p==="system"&&m&&m.matches?"light":"dark";d.setAttribute("data-theme",t);d.style.colorScheme=t}apply();if(m&&m.addEventListener)m.addEventListener("change",function(){if(pref()==="system")apply()});window.addEventListener("storage",function(e){if(e.key===k)apply()})})();`;

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return (THEME_PREFERENCES as readonly string[]).includes(value ?? "") ? (value as ThemePreference) : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return preference;
}

export const THEME_CHANGE_EVENT = "kt-theme-change";

export function applyThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or storage blocked: the change still applies to this page.
  }
  const theme = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
