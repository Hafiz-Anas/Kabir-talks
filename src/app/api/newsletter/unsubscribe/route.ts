import { tokenSchema } from "@/lib/newsletter";
import { unsubscribe } from "@/server/newsletter/subscribers";
import { errorResponse, json, readJson } from "@/server/reader-api";

/**
 * Unsubscribe. Two callers:
 *  - the /{locale}/newsletter/unsubscribe page: JSON { token };
 *  - mail apps' own "Unsubscribe" button (RFC 8058 one-click): a POST to the
 *    List-Unsubscribe URL with the token in the query string and the form
 *    body "List-Unsubscribe=One-Click", from the mail provider's servers.
 * No Origin check: the token is the authorization, and the worst a forged
 * request can do with a stolen token is unsubscribe that one reader.
 */
export async function POST(request: Request) {
  const fromQuery = new URL(request.url).searchParams.get("token");
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  const body = type.startsWith("application/json") ? await readJson(request, 1_000) : null;
  const parsed = tokenSchema.safeParse(fromQuery ? { token: fromQuery } : body);
  if (!parsed.success) return errorResponse("invalid_token", 400);
  return (await unsubscribe(parsed.data.token)) ? json({ ok: true }) : errorResponse("invalid_token", 400);
}
