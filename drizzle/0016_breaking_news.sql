CREATE TABLE "breaking_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_en" text,
	"text_ur" text,
	"article_id" uuid,
	"link_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "breaking_news_has_text" CHECK (coalesce(btrim("breaking_news"."text_en"), '') <> '' OR coalesce(btrim("breaking_news"."text_ur"), '') <> ''),
	CONSTRAINT "breaking_news_one_link" CHECK ("breaking_news"."article_id" IS NULL OR "breaking_news"."link_url" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "breaking_news_active_created_idx" ON "breaking_news" USING btree ("is_active","created_at" DESC NULLS LAST);