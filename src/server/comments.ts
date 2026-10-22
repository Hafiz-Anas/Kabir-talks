import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { articles, categories, comments, user } from "@/db/schema";
import {
  COMMENT_EDIT_WINDOW_MS,
  COMMENT_RATE_LIMIT,
  type CommentErrorCode,
  type CommentViewer,
  type ThreadComment,
  type ThreadResponse,
} from "@/lib/comments";
import { safeAvatarSrc } from "@/lib/content/urls";

import { isPublished } from "./public/articles";
import { consumeRateLimit } from "./rate-limit";
import { imagePrefix } from "./storage";

/**
 * Comments: the reader-facing thread, posting/editing/deleting, and the admin
 * moderation queue. Comments belong to the article, not a language, so the
 * English and Urdu pages show the same discussion.
 *
 * Visibility rules (enforced here, nowhere else):
 *  - Everyone sees APPROVED comments; a reader also sees their own PENDING ones.
 *  - Replies are one level deep and only show under an approved parent.
 *  - A deleted comment with replies stays as a "Comment deleted" placeholder
 *    (deleted_at set, body emptied); without replies it is removed.
 * Callers pass the signed-in user's id from the session — never from input.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: CommentErrorCode };

const MAX_THREAD_ROWS = 1000;

function avatar(image: string | null) {
  return safeAvatarSrc(image, imagePrefix());
}

async function viewerRow(userId: string) {
  const [row] = await db
    .select({ name: user.name, image: user.image, role: user.role, blocked: user.commentingBlocked })
    .from(user)
    .where(eq(user.id, userId));
  return row ?? null;
}

async function liveArticle(articleId: string) {
  const [row] = await db
    .select({ id: articles.id, commentsEnabled: articles.commentsEnabled })
    .from(articles)
    .where(and(eq(articles.id, articleId), isPublished));
  return row ?? null;
}

const parentComments = alias(comments, "parent_comment");

/** Approved, not deleted, and (for replies) under an approved parent: what the public count shows. */
export async function countVisibleComments(articleId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(comments)
    .leftJoin(parentComments, eq(parentComments.id, comments.parentId))
    .where(
      and(
        eq(comments.articleId, articleId),
        eq(comments.status, "APPROVED"),
        isNull(comments.deletedAt),
        or(isNull(comments.parentId), eq(parentComments.status, "APPROVED")),
      ),
    );
  return row?.total ?? 0;
}

/** The thread for one article as `viewerId` sees it, or null if the article isn't published. */
export async function getThread(articleId: string, viewerId: string | null): Promise<ThreadResponse | null> {
  const article = await liveArticle(articleId);
  if (!article) return null;

  const me = viewerId ? await viewerRow(viewerId) : null;
  const viewer: CommentViewer = me
    ? { signedIn: true, blocked: me.blocked, isAdmin: me.role === "admin", name: me.name, image: avatar(me.image) }
    : { signedIn: false };

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      userId: comments.userId,
      name: user.name,
      image: user.image,
      role: user.role,
    })
    .from(comments)
    .leftJoin(user, eq(user.id, comments.userId))
    .where(
      and(
        eq(comments.articleId, articleId),
        viewerId
          ? or(eq(comments.status, "APPROVED"), and(eq(comments.userId, viewerId), eq(comments.status, "PENDING")))
          : eq(comments.status, "APPROVED"),
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(MAX_THREAD_ROWS);

  const now = Date.now();
  const toItem = (row: (typeof rows)[number], replies: ThreadComment[]): ThreadComment => {
    const deleted = row.deletedAt !== null;
    const own = Boolean(viewerId && row.userId === viewerId);
    return {
      id: row.id,
      parentId: row.parentId,
      body: deleted ? null : row.body,
      deleted,
      status: row.status === "APPROVED" ? "APPROVED" : "PENDING",
      author: deleted
        ? null
        : {
            name: row.userId ? row.name : null,
            image: row.userId ? avatar(row.image) : null,
            isAdmin: row.role === "admin",
            isYou: own,
          },
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      canEdit: own && !deleted && !me?.blocked && now - row.createdAt.getTime() < COMMENT_EDIT_WINDOW_MS,
      canDelete: own && !deleted,
      replies,
    };
  };

  const repliesByParent = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.parentId || row.deletedAt) continue;
    repliesByParent.set(row.parentId, [...(repliesByParent.get(row.parentId) ?? []), row]);
  }

  const thread: ThreadComment[] = [];
  let visible = 0;
  for (const row of rows) {
    if (row.parentId) continue;
    // Replies are only shown under an approved parent (not under someone's pending one).
    const replies = row.status === "APPROVED" ? (repliesByParent.get(row.id) ?? []).map((reply) => toItem(reply, [])) : [];
    if (row.deletedAt && replies.length === 0) continue;
    thread.push(toItem(row, replies));
    if (row.status === "APPROVED" && !row.deletedAt) visible++;
    visible += replies.filter((reply) => reply.status === "APPROVED").length;
  }

  return { commentsEnabled: article.commentsEnabled, count: visible, viewer, comments: thread };
}

/** Post a comment or a reply (to a top-level, approved comment). Readers' comments start PENDING; the admin's are approved. */
export async function createComment(
  userId: string,
  input: { articleId: string; parentId?: string | null; body: string },
): Promise<Result<{ id: string; status: "APPROVED" | "PENDING" }>> {
  const me = await viewerRow(userId);
  if (!me) return { ok: false, error: "unauthorized" };
  if (me.blocked) return { ok: false, error: "blocked" };
  const article = await liveArticle(input.articleId);
  if (!article) return { ok: false, error: "not_found" };
  if (!article.commentsEnabled) return { ok: false, error: "closed" };

  if (input.parentId) {
    const [parent] = await db
      .select({ articleId: comments.articleId, parentId: comments.parentId, status: comments.status, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, input.parentId));
    if (!parent || parent.articleId !== input.articleId || parent.parentId || parent.deletedAt || parent.status !== "APPROVED") {
      return { ok: false, error: "invalid" };
    }
  }

  const isAdmin = me.role === "admin";
  if (!isAdmin && !(await consumeRateLimit(`comment:${userId}`, COMMENT_RATE_LIMIT.max, COMMENT_RATE_LIMIT.windowSeconds))) {
    return { ok: false, error: "rate_limited" };
  }

  const status = isAdmin ? "APPROVED" : "PENDING";
  const [row] = await db
    .insert(comments)
    .values({ articleId: input.articleId, userId, parentId: input.parentId ?? null, body: input.body, status })
    .returning({ id: comments.id });
  return { ok: true, id: row.id, status };
}

/**
 * The author edits their own comment within 15 minutes of posting. A
 * reader's edited comment goes back to PENDING, so an approved comment can't
 * be swapped for spam afterwards.
 */
export async function editOwnComment(userId: string, commentId: string, body: string): Promise<Result> {
  const me = await viewerRow(userId);
  if (!me) return { ok: false, error: "unauthorized" };
  const [row] = await db
    .select({ createdAt: comments.createdAt, deletedAt: comments.deletedAt })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
  if (!row || row.deletedAt) return { ok: false, error: "not_found" };
  if (me.blocked) return { ok: false, error: "blocked" };
  if (Date.now() - row.createdAt.getTime() >= COMMENT_EDIT_WINDOW_MS) return { ok: false, error: "edit_expired" };

  await db
    .update(comments)
    .set({ body, editedAt: new Date(), ...(me.role === "admin" ? {} : { status: "PENDING" as const }) })
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
  return { ok: true };
}

/** Deletes one comment: a placeholder if it still has replies, otherwise the row (and an emptied parent placeholder). */
async function removeComment(row: { id: string; parentId: string | null }) {
  if (!row.parentId) {
    const [{ replies }] = await db.select({ replies: count() }).from(comments).where(eq(comments.parentId, row.id));
    if (replies > 0) {
      await db.update(comments).set({ deletedAt: new Date(), body: "" }).where(eq(comments.id, row.id));
    } else {
      await db.delete(comments).where(eq(comments.id, row.id));
    }
    return;
  }
  await db.delete(comments).where(eq(comments.id, row.id));
  const [parent] = await db.select({ deletedAt: comments.deletedAt }).from(comments).where(eq(comments.id, row.parentId));
  if (parent?.deletedAt) {
    const [{ replies }] = await db.select({ replies: count() }).from(comments).where(eq(comments.parentId, row.parentId));
    if (replies === 0) await db.delete(comments).where(eq(comments.id, row.parentId));
  }
}

/** The author deletes their own comment, at any time. */
export async function deleteOwnComment(userId: string, commentId: string): Promise<Result> {
  const [row] = await db
    .select({ id: comments.id, parentId: comments.parentId, deletedAt: comments.deletedAt })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
  if (!row || row.deletedAt) return { ok: false, error: "not_found" };
  await removeComment(row);
  return { ok: true };
}

// ── Admin moderation (callers must have passed requireAdmin()) ──

export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";
export const MODERATION_PAGE_SIZE = 25;

export async function moderationCounts(): Promise<Record<ModerationStatus, number>> {
  const rows = await db
    .select({ status: comments.status, total: count() })
    .from(comments)
    .where(isNull(comments.deletedAt))
    .groupBy(comments.status);
  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

export async function pendingCommentCount() {
  const [row] = await db
    .select({ total: count() })
    .from(comments)
    .where(and(eq(comments.status, "PENDING"), isNull(comments.deletedAt)));
  return row?.total ?? 0;
}

/** One page of the queue. Pending: oldest first (work through it); others: newest first. */
export async function listForModeration(status: ModerationStatus, page: number) {
  const where = and(eq(comments.status, status), isNull(comments.deletedAt));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        parentId: comments.parentId,
        parentBody: parentComments.body,
        userId: comments.userId,
        authorName: user.name,
        authorEmail: user.email,
        authorRole: user.role,
        authorBlocked: user.commentingBlocked,
        articleId: articles.id,
        articleSlug: articles.slug,
        articleStatus: articles.status,
        titleEn: articles.titleEn,
        titleUr: articles.titleUr,
        categorySlug: categories.slug,
      })
      .from(comments)
      .innerJoin(articles, eq(articles.id, comments.articleId))
      .innerJoin(categories, eq(categories.id, articles.categoryId))
      .leftJoin(user, eq(user.id, comments.userId))
      .leftJoin(parentComments, eq(parentComments.id, comments.parentId))
      .where(where)
      .orderBy(status === "PENDING" ? asc(comments.createdAt) : desc(comments.createdAt), asc(comments.id))
      .limit(MODERATION_PAGE_SIZE)
      .offset((page - 1) * MODERATION_PAGE_SIZE),
    db.select({ total: count() }).from(comments).where(where),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / MODERATION_PAGE_SIZE)) };
}

export type ModerationRow = Awaited<ReturnType<typeof listForModeration>>["rows"][number];

export async function setCommentStatus(ids: string[], status: "APPROVED" | "REJECTED") {
  if (!ids.length) return 0;
  const updated = await db
    .update(comments)
    .set({ status })
    .where(and(inArray(comments.id, ids), isNull(comments.deletedAt)))
    .returning({ id: comments.id });
  return updated.length;
}

export async function adminDeleteComment(commentId: string): Promise<Result> {
  const [row] = await db
    .select({ id: comments.id, parentId: comments.parentId })
    .from(comments)
    .where(eq(comments.id, commentId));
  if (!row) return { ok: false, error: "not_found" };
  await removeComment(row);
  return { ok: true };
}

/**
 * Reply as the admin: always approved. Replies stay one level deep, so a
 * reply to a reply goes under the same top-level comment. Replying to a
 * pending comment approves it too (otherwise the reply would be invisible).
 */
export async function adminReply(adminId: string, commentId: string, body: string): Promise<Result<{ id: string }>> {
  const [target] = await db
    .select({ id: comments.id, parentId: comments.parentId, articleId: comments.articleId })
    .from(comments)
    .where(eq(comments.id, commentId));
  if (!target) return { ok: false, error: "not_found" };
  const topId = target.parentId ?? target.id;

  const [row] = await db.transaction(async (tx) => {
    await tx
      .update(comments)
      .set({ status: "APPROVED" })
      .where(and(eq(comments.id, topId), eq(comments.status, "PENDING"), isNull(comments.deletedAt)));
    return tx
      .insert(comments)
      .values({ articleId: target.articleId, userId: adminId, parentId: topId, body, status: "APPROVED" })
      .returning({ id: comments.id });
  });
  return { ok: true, id: row.id };
}

/** Block or unblock a reader from commenting. Admin accounts can't be blocked. */
export async function setCommentingBlocked(userId: string, blocked: boolean): Promise<Result> {
  const updated = await db
    .update(user)
    .set({ commentingBlocked: blocked })
    .where(and(eq(user.id, userId), eq(user.role, "reader")))
    .returning({ id: user.id });
  return updated.length ? { ok: true } : { ok: false, error: "not_found" };
}
