import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, localeEnum } from "./_shared";

export const emailProviderEnum = pgEnum("email_provider", ["log", "resend"]);
export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

/**
 * Phase 7: every email the site sends (src/server/email). The "log" driver
 * (no Resend key) keeps the full message here so the admin can preview it on
 * /admin/emails. The "resend" driver records only who/what/when (html and
 * text stay null), so a newsletter to thousands of readers doesn't copy
 * every message into the database. Rows older than 30 days are pruned.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    // What sent it, e.g. "verify", "reset", "newsletter-confirm", "newsletter-article", "digest", "contact".
    kind: text("kind").notNull(),
    locale: localeEnum("locale").default("en").notNull(),
    provider: emailProviderEnum("provider").notNull(),
    status: emailStatusEnum("status").notNull(),
    html: text("html"),
    text: text("text"),
    // Extra headers, e.g. List-Unsubscribe. Like html/text, kept only by the log driver (they hold link tokens).
    headers: jsonb("headers").$type<Record<string, string>>(),
    // Resend's message id, or the error message when status = failed (never the message itself).
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (table) => [index("email_outbox_created_at_idx").on(table.createdAt)],
);
