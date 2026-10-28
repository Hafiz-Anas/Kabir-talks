-- Phase 7: confirmation tokens are stored only as an HMAC (confirm_token_hash), so the never-used plain column goes.
-- email_outbox.headers: List-Unsubscribe etc., kept (like html/text) only by the log driver for the admin preview.
ALTER TABLE "newsletter_subscribers" DROP CONSTRAINT "newsletter_subscribers_confirm_token_unique";--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "headers" jsonb;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" DROP COLUMN "confirm_token";