-- Phase 6: AI cost guards shared by every server instance.
-- ai_usage: model calls per Pakistan date and feature (admin, summary, ask, listen), counts only.
-- The global daily cap (AI_DAILY_LIMIT) is checked against the day's total; the admin dashboard shows it.
-- Per-minute and per-reader daily limits reuse the Phase 5 rate_limit table (keys "ai:…"); no change needed there.
CREATE TABLE "ai_usage" (
	"day" date NOT NULL,
	"feature" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_day_feature_pk" PRIMARY KEY("day","feature")
);--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
