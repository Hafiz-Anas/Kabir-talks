-- Phase 7 view counting: one row per (article, PKT day, daily-salted visitor hash) so a visitor counts once a day.
-- No IP is stored; rows older than two days are deleted by the app. Plus a date index for the dashboard's ranges.
CREATE TABLE "article_view_visitors" (
	"article_id" uuid NOT NULL,
	"date" date NOT NULL,
	"visitor_hash" text NOT NULL,
	CONSTRAINT "article_view_visitors_article_id_date_visitor_hash_pk" PRIMARY KEY("article_id","date","visitor_hash")
);
--> statement-breakpoint
ALTER TABLE "article_view_visitors" ADD CONSTRAINT "article_view_visitors_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_view_visitors_date_idx" ON "article_view_visitors" USING btree ("date");--> statement-breakpoint
CREATE INDEX "article_views_date_idx" ON "article_views" USING btree ("date");--> statement-breakpoint
-- Same as every other table (0001_enable_rls): block Supabase's REST API, the app bypasses RLS.
ALTER TABLE "article_view_visitors" ENABLE ROW LEVEL SECURITY;
