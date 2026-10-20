import "./src/db/load-env";

import { defineConfig } from "drizzle-kit";

// Migrations use the DIRECT connection (port 5432). The transaction pooler
// (port 6543) used at runtime is not suitable for DDL/migrations.
const url = process.env.DIRECT_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});

if (!url && process.argv.some((arg) => ["migrate", "push", "studio", "pull"].includes(arg))) {
  throw new Error("DIRECT_URL is not set. Add Supabase's direct connection string (port 5432) to .env.local.");
}
