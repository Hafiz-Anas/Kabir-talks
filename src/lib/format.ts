/**
 * Display timezone for dates rendered on the server (Vercel runs in UTC).
 * Change here if the newsroom works in a different zone.
 */
export const SITE_TIME_ZONE = "Asia/Karachi";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SITE_TIME_ZONE,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: SITE_TIME_ZONE,
});

export function formatDateTime(value: Date | string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value: Date | string | null | undefined) {
  return value ? dateOnly.format(new Date(value)) : "—";
}

const publicDate = {
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: SITE_TIME_ZONE }),
  // ur-PK gives Urdu month names with Western digits, e.g. "21 اکتوبر، 2026".
  ur: new Intl.DateTimeFormat("ur-PK", { day: "numeric", month: "long", year: "numeric", timeZone: SITE_TIME_ZONE }),
} as const;

/** Reader-facing date in the page's language. Safe on server and client (fixed time zone). */
export function formatPublicDate(value: Date | string, locale: "en" | "ur") {
  return publicDate[locale].format(new Date(value));
}

const relative = {
  en: new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" }),
  ur: new Intl.RelativeTimeFormat("ur-PK", { numeric: "auto" }),
} as const;

/** "5 minutes ago" / "۵ منٹ پہلے" for the last week, then the date. For comments (rendered in the browser). */
export function formatRelative(value: Date | string, locale: "en" | "ur", now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs >= 7 * 86400) return formatPublicDate(value, locale);
  if (abs < 60) return relative[locale].format(0, "second");
  if (abs < 3600) return relative[locale].format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative[locale].format(Math.round(seconds / 3600), "hour");
  return relative[locale].format(Math.round(seconds / 86400), "day");
}
