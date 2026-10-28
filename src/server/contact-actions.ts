"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

/** Admin → Messages actions. requireAdmin() + Zod on every call. */

export type MessageActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();

export async function setMessageRead(id: string, isRead: boolean): Promise<MessageActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, isRead: z.boolean() }).safeParse({ id, isRead });
  if (!parsed.success) return { ok: false, error: "Message not found." };
  const [row] = await db
    .update(contactMessages)
    .set({ isRead: parsed.data.isRead })
    .where(eq(contactMessages.id, parsed.data.id))
    .returning({ id: contactMessages.id });
  if (!row) return { ok: false, error: "Message not found." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<MessageActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Message not found." };
  const [row] = await db.delete(contactMessages).where(eq(contactMessages.id, parsed.data)).returning({ id: contactMessages.id });
  if (!row) return { ok: false, error: "Message not found." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
