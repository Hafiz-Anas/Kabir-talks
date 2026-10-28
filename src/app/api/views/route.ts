import { z } from "zod";

import { clientIp, errorResponse, readJson, rejectCrossSite } from "@/server/reader-api";
import { recordView } from "@/server/views";

/** View beacon from article pages (components/articles/view-beacon.tsx). Always 204 unless the request is malformed or rate limited. */

const bodySchema = z.object({ articleId: z.uuid() });

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const parsed = bodySchema.safeParse(await readJson(request, 500));
  if (!parsed.success) return errorResponse("invalid", 400);
  const outcome = await recordView(parsed.data.articleId, request, clientIp(request));
  if (outcome === "rate_limited") return errorResponse("rate_limited", 429);
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store", "X-View": outcome } });
}
