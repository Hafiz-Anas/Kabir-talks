-- Phase 7: every email the site sends (src/server/email). The "log" driver keeps the full message for the admin
-- preview (/admin/emails); the "resend" driver keeps only metadata. Rows older than 30 days are pruned by the app.
CREATE TYPE "public"."email_provider" AS ENUM('log', 'resend');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"provider" "email_provider" NOT NULL,
	"status" "email_status" NOT NULL,
	"html" text,
	"text" text,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_outbox_created_at_idx" ON "email_outbox" USING btree ("created_at");--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;
