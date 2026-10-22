"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-guards";
import { commentBodySchema, type CommentErrorCode } from "@/lib/comments";

import { adminDeleteComment, adminReply, setCommentingBlocked, setCommentStatus } from "./comments";

/**
 * Comment moderation for /admin/comments. Every action calls requireAdmin()
 * first (readers get a 404, signed-out visitors a redirect) and validates its
 * input with Zod. Comments load in the browser on public pages, so nothing
 * public needs revalidating; only the admin layout (sidebar pending badge).
 */

export type ModerationResult = { ok: true; count?: number } | { ok: false; error: CommentErrorCode };

const idsSchema = z.array(z.uuid()).min(1).max(100);

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

async function setStatus(ids: unknown, status: "APPROVED" | "REJECTED"): Promise<ModerationResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const count = await setCommentStatus(parsed.data, status);
  refreshAdmin();
  return { ok: true, count };
}

export async function approveComments(ids: string[]) {
  return setStatus(ids, "APPROVED");
}

export async function rejectComments(ids: string[]) {
  return setStatus(ids, "REJECTED");
}

export async function deleteCommentAsAdmin(id: string): Promise<ModerationResult> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await adminDeleteComment(parsed.data);
  refreshAdmin();
  return result.ok ? { ok: true } : result;
}

export async function replyAsAdmin(commentId: string, body: string): Promise<ModerationResult> {
  const session = await requireAdmin();
  const parsed = z.object({ commentId: z.uuid(), body: commentBodySchema }).safeParse({ commentId, body });
  if (!parsed.success) {
    const message = parsed.error.issues.find((issue) => issue.path[0] === "body")?.message;
    return { ok: false, error: message === "empty" || message === "too_long" ? message : "invalid" };
  }
  const result = await adminReply(session.user.id, parsed.data.commentId, parsed.data.body);
  refreshAdmin();
  return result.ok ? { ok: true } : result;
}

export async function setReaderCommentingBlocked(userId: string, blocked: boolean): Promise<ModerationResult> {
  await requireAdmin();
  const parsed = z.object({ userId: z.string().min(1).max(64), blocked: z.boolean() }).safeParse({ userId, blocked });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await setCommentingBlocked(parsed.data.userId, parsed.data.blocked);
  refreshAdmin();
  return result.ok ? { ok: true } : result;
}
