import {
  type AnyPgColumn,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
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
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Replies. Deleting a parent removes its thread.
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    status: commentStatus("status").default("PENDING").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("comments_article_id_status_idx").on(table.articleId, table.status),
    index("comments_user_id_idx").on(table.userId),
    index("comments_parent_id_idx").on(table.parentId),
  ],
);
