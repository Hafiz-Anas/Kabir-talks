import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./_shared";
import { user } from "./auth";

export const articleStatus = pgEnum("article_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** Tiptap / ProseMirror document JSON. Typed loosely until the editor lands in Phase 2. */
export type TiptapDoc = { type: "doc"; content?: unknown[] } & Record<string, unknown>;

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameUr: text("name_ur").notNull(),
  descriptionEn: text("description_en"),
  descriptionUr: text("description_ur"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Phase 7C: author profiles shown on articles (bylines, author pages). These
 * are NOT logins: articles.authorId stays the admin account that created the
 * article; articles.authorProfileId is who it's credited to. One author is the
 * default ("main author") that the editor preselects; migration 0017 seeds
 * "Kabir" as the default and credits every existing article to him.
 */
export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    /** Falls back to the English name when empty. */
    nameUr: text("name_ur"),
    titleEn: text("title_en"),
    titleUr: text("title_ur"),
    bioEn: text("bio_en"),
    bioUr: text("bio_ur"),
    /** An upload from our article-images bucket (same pipeline as cover images). */
    photoUrl: text("photo_url"),
    /** { youtube?, whatsapp?, facebook?, instagram?, x?, tiktok? }: validated https links (src/lib/social.ts). */
    socialLinks: jsonb("social_links").$type<Record<string, string>>().default({}).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("authors_one_default_idx").on(table.isDefault).where(sql`${table.isDefault}`)],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // RESTRICT: a category with articles cannot be deleted; reassign the articles first.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    slug: text("slug").notNull().unique(),

    // Either language may be written first; at least one title is required (see check below).
    titleEn: text("title_en"),
    titleUr: text("title_ur"),
    excerptEn: text("excerpt_en"),
    excerptUr: text("excerpt_ur"),
    bodyEn: jsonb("body_en").$type<TiptapDoc>(),
    bodyUr: jsonb("body_ur").$type<TiptapDoc>(),

    coverImageUrl: text("cover_image_url"),
    coverImageAlt: text("cover_image_alt"),

    status: articleStatus("status").default("DRAFT").notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    // Phase 3: AI-written/translated content not yet confirmed as reviewed by the admin.
    // Publishing (from the editor or the article list) is blocked while true.
    aiReviewPending: boolean("ai_review_pending").default(false).notNull(),
    // Phase 5: off = existing comments still show, no new ones (editor side panel toggle).
    commentsEnabled: boolean("comments_enabled").default(true).notNull(),

    // RESTRICT: deleting the author must not silently delete their articles.
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Phase 7C: the credited author profile. RESTRICT: reassign articles before deleting an author.
    authorProfileId: uuid("author_profile_id")
      .notNull()
      .references(() => authors.id, { onDelete: "restrict" }),

    seoTitleEn: text("seo_title_en"),
    seoTitleUr: text("seo_title_ur"),
    seoDescriptionEn: text("seo_description_en"),
    seoDescriptionUr: text("seo_description_ur"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("articles_status_published_at_idx").on(table.status, table.publishedAt.desc()),
    index("articles_category_id_idx").on(table.categoryId),
    index("articles_author_id_idx").on(table.authorId),
    index("articles_author_profile_id_idx").on(table.authorProfileId),
    check("articles_has_title", sql`${table.titleEn} IS NOT NULL OR ${table.titleUr} IS NOT NULL`),
    check(
      "articles_published_has_date",
      sql`${table.status} <> 'PUBLISHED' OR ${table.publishedAt} IS NOT NULL`,
    ),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameUr: text("name_ur"),
});

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.tagId] }),
    index("article_tags_tag_id_idx").on(table.tagId),
  ],
);
