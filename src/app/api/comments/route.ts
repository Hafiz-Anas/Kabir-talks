import { z } from "zod";

import { commentBodySchema } from "@/lib/comments";
import { createComment, getThread } from "@/server/comments";
import { bodyError, COMMENT_ERROR_STATUS, errorResponse, json, readerSession, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * GET /api/comments?articleId=<uuid>
 *   The thread as the current visitor sees it (approved comments, plus the
 *   signed-in reader's own pending ones), the visible count, whether comments
 *   are open, and what the visitor may do. Private, no-store.
 * POST /api/comments  { articleId, parentId?, body }
 *   Signed-in readers only; plain text up to 2,000 characters; rate limited.
 */

export async function GET(request: Request) {
  const articleId = z.uuid().safeParse(new URL(request.url).searchParams.get("articleId"));
  if (!articleId.success) return errorResponse("invalid", 400);
  const session = await readerSession(request);
  const thread = await getThread(articleId.data, session?.user.id ?? null);
  if (!thread) return errorResponse("not_found", 404);
  return json(thread);
}

const postSchema = z.object({
  articleId: z.uuid(),
  parentId: z.uuid().nullish(),
  body: commentBodySchema,
});

export async function POST(request: Request) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const session = await readerSession(request);
  if (!session) return errorResponse("unauthorized", 401);
  const parsed = postSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(bodyError(parsed.error), 400);

  const result = await createComment(session.user.id, parsed.data);
  if (!result.ok) return errorResponse(result.error, COMMENT_ERROR_STATUS[result.error]);
  return json({ id: result.id, status: result.status }, 201);
}
