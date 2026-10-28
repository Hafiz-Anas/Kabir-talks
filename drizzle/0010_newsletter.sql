-- Phase 7 newsletter: double opt-in subscribers (language en/ur/both, hashed link tokens) and the send queue.
-- newsletter_sends: one row per article or weekly digest (dedupe_key is unique, so nothing is queued twice).
-- newsletter_deliveries: one row per (send, subscriber), processed in small batches by npm run newsletter:process.
CREATE TYPE "public"."newsletter_delivery_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."newsletter_language" AS ENUM('en', 'ur', 'both');--> statement-breakpoint
CREATE TYPE "public"."newsletter_send_kind" AS ENUM('article', 'digest');--> statement-breakpoint
CREATE TYPE "public"."newsletter_send_status" AS ENUM('queued', 'done');--> statement-breakpoint
CREATE TABLE "newsletter_deliveries" (
	"send_id" uuid NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"status" "newsletter_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "newsletter_deliveries_send_id_subscriber_id_pk" PRIMARY KEY("send_id","subscriber_id")
);
--> statement-breakpoint
CREATE TABLE "newsletter_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "newsletter_send_kind" NOT NULL,
	"dedupe_key" text NOT NULL,
	"article_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "newsletter_send_status" DEFAULT 'queued' NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "newsletter_sends_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "language" "newsletter_language" DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirm_token_hash" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirm_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "unsubscribe_token_hash" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_send_id_newsletter_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."newsletter_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_subscriber_id_newsletter_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_sends" ADD CONSTRAINT "newsletter_sends_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_sends" ADD CONSTRAINT "newsletter_sends_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_deliveries_status_idx" ON "newsletter_deliveries" USING btree ("status");--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_confirm_token_hash_unique" UNIQUE("confirm_token_hash");--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_unsubscribe_token_hash_unique" UNIQUE("unsubscribe_token_hash");--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "newsletter_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ENABLE ROW LEVEL SECURITY;
