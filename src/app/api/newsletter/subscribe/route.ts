import { features } from "@/lib/features";
import { subscribeSchema } from "@/lib/newsletter";
import { subscribe } from "@/server/newsletter/subscribers";
import { clientIp, errorResponse, json, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * Newsletter sign-up (the box on the homepage, articles and footer). Same
 * answer whether or not the address is already subscribed; the confirmation
 * email does the rest (double opt-in).
 */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!features.newsletterEnabled) return errorResponse("unavailable", 503);

  const parsed = subscribeSchema.safeParse(await readJson(request, 2_000));
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === "email");
    return errorResponse(emailIssue ? "invalid_email" : "error", 400);
  }

  try {
    const outcome = await subscribe(parsed.data, clientIp(request));
    if (outcome === "rate_limited") return errorResponse("rate_limited", 429);
    return json({ ok: true });
  } catch (error) {
    console.error("[newsletter] subscribe failed", error instanceof Error ? error.message : error);
    return errorResponse("error", 500);
  }
}
