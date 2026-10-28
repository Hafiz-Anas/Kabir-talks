import { tokenSchema } from "@/lib/newsletter";
import { confirmSubscription } from "@/server/newsletter/subscribers";
import { errorResponse, json, readJson, rejectCrossSite } from "@/server/reader-api";

/** Called by the static /{locale}/newsletter/confirm page, so a link scanner's GET confirms nothing. */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const parsed = tokenSchema.safeParse(await readJson(request, 1_000));
  if (!parsed.success) return errorResponse("invalid_token", 400);
  return (await confirmSubscription(parsed.data.token)) ? json({ ok: true }) : errorResponse("invalid_token", 400);
}
