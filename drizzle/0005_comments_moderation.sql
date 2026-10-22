-- Phase 5: comments and moderation.
-- user.commenting_blocked: the admin can stop a reader from commenting (they can still read).
-- articles.comments_enabled: per-article switch (default on); off keeps existing comments visible but closes new ones.
-- comments.deleted_at: deleting a comment that has replies keeps a "Comment deleted" placeholder so the thread survives.
-- comments.edited_at: when the author last edited it (allowed within 15 minutes of posting).
ALTER TABLE "user" ADD COLUMN "commenting_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;