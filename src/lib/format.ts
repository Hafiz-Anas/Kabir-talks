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
