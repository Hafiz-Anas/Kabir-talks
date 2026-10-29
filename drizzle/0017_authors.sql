CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text,
	"title_en" text,
	"title_ur" text,
	"bio_en" text,
	"bio_ur" text,
	"photo_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "authors_one_default_idx" ON "authors" USING btree ("is_default") WHERE "authors"."is_default";--> statement-breakpoint
-- Hand-written (Phase 7C): seed the main author and credit every existing article to him.
INSERT INTO "authors" ("slug", "name_en", "name_ur", "title_en", "title_ur", "bio_en", "bio_ur", "is_default")
VALUES ('kabir', 'Kabir', 'کبیر', 'Founder & Editor', 'بانی و مدیر', 'Founder of Kabir Talks.', 'کبیر ٹاکس کے بانی۔', true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "author_profile_id" uuid;--> statement-breakpoint
UPDATE "articles" SET "author_profile_id" = (SELECT "id" FROM "authors" WHERE "slug" = 'kabir');--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "author_profile_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_profile_id_authors_id_fk" FOREIGN KEY ("author_profile_id") REFERENCES "public"."authors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_author_profile_id_idx" ON "articles" USING btree ("author_profile_id");