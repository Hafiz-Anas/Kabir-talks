import { READER_CALLS_PER_MINUTE } from "@/lib/ai/config";
import { summaryRequestSchema, type SummaryResponse } from "@/lib/ai/reader";
import { features } from "@/lib/features";
import { generateSummary, getFreshSummary, loadArticleSource } from "@/server/ai/summaries";
import { clientIp, errorResponse, json, readerAiFailure, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * Article summaries for readers (no sign-in needed). Loaded by the article
 * page's Summarise panel in the browser, so the page itself stays static.
 *
 * GET  /api/ai/summary?articleId=<uuid>&locale=en|ur
 *   The cached summary, or { status: "missing" }. Never calls the model, so
 *   crawlers and link prefetchers can't spend anything.
 * POST /api/ai/summary  { articleId, locale }   (same-origin JSON)
 *   Generates a missing summary once (concurrent clicks share one model
 *   call), counted against the daily cap and a per-IP minute limit.
 *   202 { status: "generating" } if another instance is still on it.
 *
 * Only PUBLISHED articles with that language: anything else is 404.
 * Responses are private, no-store.
 */

export const maxDuration = 60;

async function sourceFor(input: unknown) {
  const parsed = summaryRequestSchema.safeParse(input);
  if (!parsed.success) return { response: errorResponse("invalid", 400) };
  if (!features.aiEnabled) return { response: errorResponse("not_configured", 503) };
  const source = await loadArticleSource(parsed.data.articleId, parsed.data.locale, { publishedOnly: true });
  if (!source) return { response: errorResponse("not_found", 404) };
  return { source };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { source, response } = await sourceFor({ articleId: params.get("articleId"), locale: params.get("locale") });
  if (!source) return response;
  const summary = await getFreshSummary(source);
  return json((summary ? { status: "ready", summary } : { status: "missing" }) satisfies SummaryResponse);
}

export async function POST(request: Request) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const { source, response } = await sourceFor(await readJson(request, 1_000));
  if (!source) return response;

  try {
    // No abort signal: if the reader leaves, the summary is still finished and cached for the next one.
    const summary = await generateSummary(source, {
      rateKey: `ip:${clientIp(request)}`,
      perMinute: READER_CALLS_PER_MINUTE,
      waitMs: 40_000,
    });
    if (!summary) return json({ status: "generating" } satisfies SummaryResponse, 202);
    return json({ status: "ready", summary } satisfies SummaryResponse);
  } catch (error) {
    const failure = readerAiFailure(error);
    return errorResponse(failure.error, failure.status);
  }
}
