import { z } from "zod";

import { BOOKMARK_STATE_MAX_IDS, savedAmong, setBookmark } from "@/server/bookmarks";
import { errorResponse, json, readerSession, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * GET /api/reader/bookmarks?ids=<uuid>,<uuid>,…
 *   Saved state for every bookmark button on a page, in ONE request.
 *   Signed out → { signedIn: false, saved: [] } (200, so pages don't log errors).
 * POST /api/reader/bookmarks  { articleId, saved }
 *   Save/unsave for the signed-in reader only. 401 if signed out.
 * Both are private, no-store (src/server/reader-api.ts).
 */

const idsSchema = z
  .string()
  .max(BOOKMARK_STATE_MAX_IDS * 37)
  .transform((value) => [...new Set(value.split(",").filter(Boolean))])
  .pipe(z.array(z.uuid()).max(BOOKMARK_STATE_MAX_IDS));

export async function GET(request: Request) {
  const parsed = idsSchema.safeParse(new URL(request.url).searchParams.get("ids") ?? "");
  if (!parsed.success) return errorResponse("invalid", 400);
  const session = await readerSession(request);
  if (!session) return json({ signedIn: false, saved: [] });
  return json({ signedIn: true, saved: await savedAmong(session.user.id, parsed.data) });
}

const toggleSchema = z.object({ articleId: z.uuid(), saved: z.boolean() });

export async function POST(request: Request) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const session = await readerSession(request);
  if (!session) return errorResponse("unauthorized", 401);
  const parsed = toggleSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse("invalid", 400);

  const ok = await setBookmark(session.user.id, parsed.data.articleId, parsed.data.saved);
  if (!ok) return errorResponse("not_found", 404);
  return json({ saved: parsed.data.saved });
}
