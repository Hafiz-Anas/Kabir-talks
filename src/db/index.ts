import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Single shared database client.
 *
 * DATABASE_URL must be Supabase's *transaction pooler* (port 6543). The pooler
 * does not support prepared statements, hence `prepare: false`.
 *
 * In development the client is cached on globalThis so hot reloads don't open
 * a new pool on every file change.
 */
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    // Serverless functions should keep their pools tiny; the pooler multiplexes.
    max: env.NODE_ENV === "production" ? 1 : 5,
  });

if (env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });

export type Db = typeof db;
export { client as pgClient };
