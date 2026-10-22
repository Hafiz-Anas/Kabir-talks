-- Phase 5: database-backed rate limits (sign-in/sign-up per IP via Better Auth; comments per reader).
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "rate_limit" ENABLE ROW LEVEL SECURITY;
