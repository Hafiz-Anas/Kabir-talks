import { z } from "zod";

/**
 * Comment rules shared by the comment form (counter) and the server.
 * Comments are plain text: stored as typed (after normalising), always
 * rendered as escaped text, never as HTML, and links are not made clickable.
 */

export const COMMENT_MAX = 2000;
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Per reader, stored in the rate_limit table (src/server/rate-limit.ts). */
export const COMMENT_RATE_LIMIT = { max: 5, windowSeconds: 10 * 60 } as const;

/**
 * NFC, Windows/Mac line endings → \n, control characters and bidi overrides
 * removed (they can disguise text), at most one blank line in a row, trimmed.
 * Zero-width joiners are kept: Urdu needs them.
 */
export function normalizeCommentBody(value: string) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Length as the reader sees it (emoji and combined letters count once per code point). */
export function commentLength(value: string) {
  return Array.from(normalizeCommentBody(value)).length;
}

export const commentBodySchema = z
  .string()
  .max(COMMENT_MAX * 4)
  .transform(normalizeCommentBody)
  .pipe(
    z
      .string()
      .min(1, "empty")
      .refine((value) => Array.from(value).length <= COMMENT_MAX, "too_long"),
  );

// ── Shapes returned by GET /api/comments ──

export type ThreadAuthor = {
  /** Null for a deleted account ("Deleted user"). */
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isYou: boolean;
};

export type ThreadComment = {
  id: string;
  parentId: string | null;
  /** Null when deleted (shown as "Comment deleted" because it still has replies). */
  body: string | null;
  deleted: boolean;
  status: "APPROVED" | "PENDING";
  author: ThreadAuthor | null;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  replies: ThreadComment[];
};

export type CommentViewer =
  | { signedIn: false }
  | { signedIn: true; blocked: boolean; isAdmin: boolean; name: string; image: string | null };

export type ThreadResponse = {
  commentsEnabled: boolean;
  count: number;
  viewer: CommentViewer;
  comments: ThreadComment[];
};

/** Error codes from the comment endpoints; the UI maps them to dictionary text. */
export type CommentErrorCode =
  | "unauthorized"
  | "blocked"
  | "closed"
  | "rate_limited"
  | "empty"
  | "too_long"
  | "invalid"
  | "not_found"
  | "edit_expired"
  | "forbidden";
