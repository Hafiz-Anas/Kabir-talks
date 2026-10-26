-- Phase 6: summaries and single-run AI jobs.
-- ai_summaries.questions: 3 suggested "Ask this article" starter questions, generated with the summary.
-- ai_summaries.source_hash: SHA-256 of the text the summary was made from. A summary is out of date when the
--   article was updated after source_updated_at AND the text changed; edits to tags/SEO don't regenerate it.
--   Existing rows (none in practice) get '' and are regenerated on first use.
-- ai_jobs: short leases ("summary:{id}:{locale}", "audio:{id}:{locale}") so a job runs once across instances.
CREATE TABLE "ai_jobs" (
	"key" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "source_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "ai_jobs" ENABLE ROW LEVEL SECURITY;
