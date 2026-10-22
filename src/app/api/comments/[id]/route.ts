import { z } from "zod";

import { commentBodySchema } from "@/lib/comments";
import { deleteOwnComment, editOwnComment } from "@/server/comments";
import { bodyError, COMMENT_ERROR_STATUS, errorResponse, json, readerSession, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * PATCH  /api/comments/{id}  { body }  edit your own comment (within 15 minutes)
 * DELETE /api/comments/{id}            delete your own comment (any time)
 * Another reader's comment answers 404, the same as a missing one.
 */

async function prepare(request: Request, params: Promise<{ id: string }>) {
  const rejected = rejectCrossSite(request);
  if (rejected) return { response: rejected };
  const session = await readerSession(request);
  if (!session) return { response: errorResponse("unauthorized", 401) };
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return { response: errorResponse("not_found", 404) };
  return { userId: session.user.id, id: id.data };
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/comments/[id]">) {
  const ready = await prepare(request, params);
  if ("response" in ready) return ready.response;
  const parsed = z.object({ body: commentBodySchema }).safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(bodyError(parsed.error), 400);
  const result = await editOwnComment(ready.userId, ready.id, parsed.data.body);
  if (!result.ok) return errorResponse(result.error, COMMENT_ERROR_STATUS[result.error]);
  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteContext<"/api/comments/[id]">) {
  const ready = await prepare(request, params);
  if ("response" in ready) return ready.response;
  const result = await deleteOwnComment(ready.userId, ready.id);
  if (!result.ok) return errorResponse(result.error, COMMENT_ERROR_STATUS[result.error]);
  return json({ ok: true });
}
