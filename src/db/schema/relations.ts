import { relations } from "drizzle-orm";

import { aiSummaries } from "./ai";
import { account, session, user } from "./auth";
import { articles, articleTags, categories, tags } from "./content";
import { articleViews } from "./growth";
import { bookmarks, comments } from "./readers";

// Auth
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  articles: many(articles),
  bookmarks: many(bookmarks),
  comments: many(comments),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// Content
export const categoryRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
}));

export const articleRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, { fields: [articles.categoryId], references: [categories.id] }),
  author: one(user, { fields: [articles.authorId], references: [user.id] }),
  articleTags: many(articleTags),
  bookmarks: many(bookmarks),
  comments: many(comments),
  aiSummaries: many(aiSummaries),
  views: many(articleViews),
}));

export const tagRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}));

export const articleTagRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, { fields: [articleTags.articleId], references: [articles.id] }),
  tag: one(tags, { fields: [articleTags.tagId], references: [tags.id] }),
}));

// Readers
export const bookmarkRelations = relations(bookmarks, ({ one }) => ({
  user: one(user, { fields: [bookmarks.userId], references: [user.id] }),
  article: one(articles, { fields: [bookmarks.articleId], references: [articles.id] }),
}));

export const commentRelations = relations(comments, ({ one, many }) => ({
  article: one(articles, { fields: [comments.articleId], references: [articles.id] }),
  user: one(user, { fields: [comments.userId], references: [user.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_replies",
  }),
  replies: many(comments, { relationName: "comment_replies" }),
}));

// AI
export const aiSummaryRelations = relations(aiSummaries, ({ one }) => ({
  article: one(articles, { fields: [aiSummaries.articleId], references: [articles.id] }),
}));

// Growth
export const articleViewRelations = relations(articleViews, ({ one }) => ({
  article: one(articles, { fields: [articleViews.articleId], references: [articles.id] }),
}));
