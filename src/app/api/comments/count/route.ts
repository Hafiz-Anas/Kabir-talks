import { z } from "zod";

import { countVisibleComments } from "@/server/comments";
import { errorResponse, json } from "@/server/reader-api";

/**
 * GET /api/comments/count?articleId=<uuid>  →  { count }
 * The number shown near the top of an article (approved, visible comments).
 * Tiny and separate from the thread, so the thread itself can load only when
 * the comments section scrolls into view. Not cached: moderation shows at once.
 */
export async function GET(request: Request) {
  const articleId = z.uuid().safeParse(new URL(request.url).searchParams.get("articleId"));
  if (!articleId.success) return errorResponse("invalid", 400);
  return json({ count: await countVisibleComments(articleId.data) });
}
