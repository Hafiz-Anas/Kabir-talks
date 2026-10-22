-- Phase 5: reader profile.
-- 1. user.preferred_locale: the reader's chosen language (en/ur), null until they pick one.
-- 2. comments.user_id becomes nullable with ON DELETE SET NULL (was CASCADE): deleting an
--    account keeps its comments, which then show as "Deleted user" with no name or photo.
ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "preferred_locale" "locale";--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;