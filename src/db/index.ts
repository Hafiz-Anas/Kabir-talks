import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Single shared database client: ONE pool per process.
 *
 * DATABASE_URL must be Supabase's *transaction pooler* (port 6543). The pooler
 * does not support prepared statements, hence `prepare: false`.
 *
 * The client is cached on globalThis in every environment. In development that
 * stops hot reloads from opening a new pool on every file change. In
 * production the bundler can evaluate this module more than once per process
 * (separate copies for route handlers, server components, server actions…);
 * without the cache each copy would open its own pool.
 */
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client = (globalForDb.pgClient ??= postgres(env.DATABASE_URL, {
  prepare: false,
  // Serverless instances keep their pools tiny; the transaction pooler
  // multiplexes. DATABASE_POOL_MAX: 5-10 for one server process; 1 for PGlite.
  max: env.DATABASE_POOL_MAX ?? (env.NODE_ENV === "production" ? 1 : 5),
}));

export const db = drizzle(client, { schema });

export type Db = typeof db;
export { client as pgClient };
