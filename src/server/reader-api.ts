import "server-only";

import type { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import type { ReaderAiError } from "@/lib/ai/reader";
import { auth } from "@/lib/auth";
import type { CommentErrorCode } from "@/lib/comments";
import { env } from "@/lib/env";

/**
 * Helpers for the per-reader route handlers (/api/reader/*, /api/comments/*,
 * and the Phase 6 reader AI endpoints /api/ai/*).
 * These are what keep public pages static: bookmark state, comments and the
 * signed-in user load in the browser through them.
 *
 *  - Every response is `Cache-Control: private, no-store`, so one reader's
 *    data is never cached by a CDN or shown to another reader.
 *  - Writes must come from our own origin with a JSON body (blocks CSRF from
 *    forms or other sites; the session cookie is also SameSite=Lax).
 *  - Ownership is checked in each handler with session.user.id.
 */

const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export function errorResponse(error: string, status: number) {
  return json({ error }, status);
}

export async function readerSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

const allowedOrigins = new Set([new URL(env.NEXT_PUBLIC_SITE_URL).origin, new URL(env.BETTER_AUTH_URL).origin]);

/** For POST/PATCH/DELETE: same-origin request with a JSON body. Returns an error response, or null if OK. */
export function rejectCrossSite(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return errorResponse("forbidden", 403);
  if (request.method !== "DELETE" && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse("unsupported", 415);
  }
  return null;
}

/** Parses a JSON body, or null if it isn't valid JSON (or is over `maxBytes`). */
export async function readJson(request: Request, maxBytes = 16_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** HTTP status for each comment error code. */
export const COMMENT_ERROR_STATUS: Record<CommentErrorCode, number> = {
  unauthorized: 401,
  blocked: 403,
  closed: 403,
  forbidden: 403,
  edit_expired: 403,
  rate_limited: 429,
  empty: 400,
  too_long: 400,
  invalid: 400,
  not_found: 404,
};

/** Zod issue → comment error code ("empty" / "too_long" come from commentBodySchema). */
export function bodyError(error: z.ZodError): CommentErrorCode {
  const message = error.issues.find((issue) => issue.path[0] === "body")?.message;
  return message === "empty" || message === "too_long" ? message : "invalid";
}

/** The visitor's IP for per-IP limits (the reverse proxy sets x-forwarded-for; the first entry is the client). */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Reader AI (Phase 6): an AiError → the error code and status the panels understand. */
export function readerAiFailure(error: unknown): { error: ReaderAiError; status: number } {
  if (!(error instanceof AiError)) return { error: "error", status: 500 };
  switch (error.code) {
    case "daily_limit":
    case "quota":
      return { error: "resting", status: 429 };
    case "rate_limited":
      return { error: "busy", status: 429 };
    case "not_configured":
      return { error: "not_configured", status: 503 };
    default:
      return { error: "unavailable", status: 503 };
  }
}
