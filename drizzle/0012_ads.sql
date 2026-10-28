-- Phase 7 ads: each placement stores only AdSense IDs (slot, format, layout); the site renders the unit itself.
-- site_settings: small JSON settings edited in the admin ("ads": publisher ID and switches; "contact": public email).
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_slots" ADD COLUMN "slot_id" text;--> statement-breakpoint
ALTER TABLE "ad_slots" ADD COLUMN "ad_format" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_slots" ADD COLUMN "ad_layout" text;--> statement-breakpoint
ALTER TABLE "ad_slots" ADD COLUMN "ad_layout_key" text;--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;
