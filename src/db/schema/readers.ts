import {
  type AnyPgColumn,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./_shared";
import { user } from "./auth";
import { articles } from "./content";

export const commentStatus = pgEnum("comment_status", ["PENDING", "APPROVED", "REJECTED"]);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.articleId] }),
    index("bookmarks_article_id_idx").on(table.articleId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    // SET NULL (Phase 5): deleting an account keeps its comments, shown as "Deleted user".
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // Replies. Deleting a parent removes its thread.
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    // Plain text only (never rendered as HTML). Emptied when the comment is deleted.
    body: text("body").notNull(),
    status: commentStatus("status").default("PENDING").notNull(),
    // Phase 5: a deleted comment that still has replies stays as a "Comment deleted" placeholder.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Phase 5: last edit by the author (allowed for 15 minutes after posting).
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("comments_article_id_status_idx").on(table.articleId, table.status),
    index("comments_user_id_idx").on(table.userId),
    index("comments_parent_id_idx").on(table.parentId),
  ],
);
