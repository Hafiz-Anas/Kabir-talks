-- Phase 7: editable Privacy Policy and Terms of Use (Tiptap JSON, both languages; seeded as templates) and the
-- contact form inbox. Bodies are sanitized on save and rendered by the shared renderer; messages are plain text.
CREATE TYPE "public"."site_page_slug" AS ENUM('privacy', 'terms');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"slug" "site_page_slug" PRIMARY KEY NOT NULL,
	"title_en" text NOT NULL,
	"title_ur" text NOT NULL,
	"body_en" jsonb,
	"body_ur" jsonb,
	"is_template" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "site_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;
