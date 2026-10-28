import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

/** Admin reads for /admin/emails. Callers must have passed requireAdmin(). */

export const OUTBOX_PAGE_SIZE = 100;

export async function listOutbox() {
  return db
    .select({
      id: emailOutbox.id,
      to: emailOutbox.to,
      subject: emailOutbox.subject,
      kind: emailOutbox.kind,
      locale: emailOutbox.locale,
      provider: emailOutbox.provider,
      status: emailOutbox.status,
      error: emailOutbox.error,
      createdAt: emailOutbox.createdAt,
    })
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt), desc(emailOutbox.id))
    .limit(OUTBOX_PAGE_SIZE);
}

export async function getOutboxEmail(id: string) {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id)).limit(1);
  return row ?? null;
}
