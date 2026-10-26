import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiJobs } from "@/db/schema";

/**
 * Single-run AI jobs across server instances (the ai_jobs table): a job
 * takes a lease before calling the model, and other requests wait for its
 * result instead of paying for the same work again. A lease older than
 * `staleAfterSeconds` belongs to a crashed or timed-out instance and can be
 * taken over.
 */

/** True if this caller now holds the lease for `key`. */
export async function acquireLease(key: string, staleAfterSeconds: number): Promise<boolean> {
  const rows = await db
    .insert(aiJobs)
    .values({ key, startedAt: new Date() })
    .onConflictDoUpdate({
      target: aiJobs.key,
      set: { startedAt: new Date() },
      setWhere: sql`${aiJobs.startedAt} < now() - make_interval(secs => ${staleAfterSeconds})`,
    })
    .returning({ key: aiJobs.key });
  return rows.length > 0;
}

export async function releaseLease(key: string) {
  await db.delete(aiJobs).where(eq(aiJobs.key, key));
}

/**
 * Process-local de-duplication on top of the lease: concurrent callers in
 * the same instance share one promise (and one database round trip).
 */
export function singleFlight<T>() {
  const inflight = new Map<string, Promise<T>>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const existing = inflight.get(key);
    if (existing) return existing;
    const promise = run().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
