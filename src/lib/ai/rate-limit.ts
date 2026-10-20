/**
 * Simple per-user sliding-window limiter for AI model calls (cost guard).
 *
 * In-memory: fine for one admin on one server. On serverless (Vercel) each
 * warm instance keeps its own counter and cold starts reset it, so the real
 * ceiling can be higher than the limit. Move this to a shared store (Postgres,
 * Redis) if AI opens to readers in Phase 6.
 */

const WINDOW_MS = 60_000;

export function createRateLimiter(limit: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  return {
    /** Records a call. Returns 0 if allowed, else seconds until a slot frees up. */
    take(key: string): number {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < WINDOW_MS);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - t) / 1000));
      }
      recent.push(t);
      hits.set(key, recent);
      return 0;
    },
  };
}
