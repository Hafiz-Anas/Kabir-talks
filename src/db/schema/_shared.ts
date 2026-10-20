import { pgEnum, timestamp } from "drizzle-orm/pg-core";

/** Content locales. Mirrors src/i18n/config.ts. */
export const localeEnum = pgEnum("locale", ["en", "ur"]);

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();
