/**
 * The AI "day" for daily limits: the Pakistan date (UTC+5, no daylight
 * saving), so caps reset at midnight for the site's readers. Pure module.
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Today's date in Pakistan, "YYYY-MM-DD". */
export function aiDay(now = Date.now()) {
  return new Date(now + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Seconds until the next Pakistan midnight. */
export function secondsUntilReset(now = Date.now()) {
  const local = now + PKT_OFFSET_MS;
  const nextMidnight = Math.floor(local / 86_400_000 + 1) * 86_400_000;
  return Math.max(1, Math.ceil((nextMidnight - local) / 1000));
}
