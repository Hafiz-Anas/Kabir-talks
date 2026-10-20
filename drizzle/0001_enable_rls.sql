-- Supabase exposes the "public" schema through its auto-generated REST API (anon/authenticated roles).
-- This app never uses that API: it connects as the "postgres" role, which bypasses RLS.
-- Enabling RLS with no policies blocks REST API access to every table while leaving the app unaffected.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_views" ENABLE ROW LEVEL SECURITY;
