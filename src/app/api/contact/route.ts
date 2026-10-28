import { CONTACT_FIELDS, type ContactField, contactSchema } from "@/lib/contact";
import { submitContact } from "@/server/contact";
import { clientIp, errorResponse, json, readJson, rejectCrossSite } from "@/server/reader-api";

/** Contact form (the static /{locale}/contact page posts here from the browser). */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const parsed = contactSchema.safeParse(await readJson(request, 12_000));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].filter((field): field is ContactField =>
      (CONTACT_FIELDS as readonly string[]).includes(field),
    );
    return json({ error: "invalid", fields }, 400);
  }
  try {
    const outcome = await submitContact(parsed.data, clientIp(request));
    if (outcome === "rate_limited") return errorResponse("rate_limited", 429);
    return json({ ok: true });
  } catch (error) {
    console.error("[contact] failed", error instanceof Error ? error.message : error);
    return errorResponse("error", 500);
  }
}
