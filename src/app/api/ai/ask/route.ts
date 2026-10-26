import { randomBytes } from "node:crypto";

import { streamText } from "@/lib/ai";
import { READER_ASK_PER_DAY, READER_CALLS_PER_MINUTE } from "@/lib/ai/config";
import { ASK_NOT_COVERED, ASK_REFUSAL, readerPrompts } from "@/lib/ai/prompts";
import { type AskEvent, askRequestSchema, cleanQuestion, QUESTION_MAX_CHARS } from "@/lib/ai/reader";
import { isExpectedScript } from "@/lib/ai/script";
import { features } from "@/lib/features";
import { takeReaderAsk } from "@/server/ai/limits";
import { loadArticleSource } from "@/server/ai/summaries";
import { errorResponse, json, readerAiFailure, readerSession, readJson, rejectCrossSite } from "@/server/reader-api";

/**
 * POST /api/ai/ask  { articleId, locale, question, history }   (same-origin JSON)
 *
 * "Ask this article" for signed-in readers. Streams NDJSON AskEvents; the
 * reader's Stop button cancels the request, which aborts the model call.
 *
 *  - Published articles only (404 otherwise), in the page's language.
 *  - Questions up to 300 characters; READER_AI_ASK_PER_DAY per reader, a
 *    per-minute burst limit, and the site's daily cap.
 *  - Answers come only from the article (see readerPrompts.ask). The
 *    output is checked too: an answer that leaks the request's secret
 *    fence code is replaced by the refusal, and an answer in the wrong
 *    script is dropped.
 *  - Nothing is stored: the question, the answer and the conversation exist
 *    only in this request and in the reader's open panel. Logs hold counts.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const parsed = askRequestSchema.safeParse(await readJson(request, 24_000));
  if (!parsed.success) return errorResponse("invalid", 400);
  if (!features.aiEnabled) return errorResponse("not_configured", 503);

  const session = await readerSession(request);
  if (!session) return errorResponse("unauthorized", 401);

  const { articleId, locale, history } = parsed.data;
  const question = cleanQuestion(parsed.data.question);
  if (!question) return errorResponse("invalid", 400);
  if (question.length > QUESTION_MAX_CHARS) return errorResponse("too_long", 400);

  const source = await loadArticleSource(articleId, locale, { publishedOnly: true });
  if (!source) return errorResponse("not_found", 404);
  if (!(await takeReaderAsk(session.user.id))) return json({ error: "ask_limit", limit: READER_ASK_PER_DAY }, 429);

  const nonce = randomBytes(9).toString("base64url");
  const { timeoutMs, ...prompt } = readerPrompts.ask({ locale, text: source.text, question, history, nonce });
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const emit = (event: AskEvent) => {
        if (!controller.signal.aborted) out.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let answer = "";
      try {
        for await (const delta of streamText(prompt, {
          rateKey: `reader:${session.user.id}`,
          perMinute: READER_CALLS_PER_MINUTE,
          feature: "ask",
          signal: controller.signal,
          timeoutMs,
        })) {
          answer += delta;
          if (answer.includes(nonce)) {
            // The model is repeating its hidden instructions: stop and refuse.
            controller.abort();
            out.enqueue(encoder.encode(`${JSON.stringify({ type: "done", refused: true, replace: ASK_REFUSAL[locale] })}\n`));
            return;
          }
          emit({ type: "delta", text: delta });
        }
        if (!isExpectedScript(answer, locale)) {
          emit({ type: "error", error: "unavailable" });
          return;
        }
        const trimmed = answer.trim();
        emit({ type: "done", refused: trimmed === ASK_REFUSAL[locale], notCovered: trimmed === ASK_NOT_COVERED[locale] });
      } catch (error) {
        if (!controller.signal.aborted) emit({ type: "error", error: readerAiFailure(error).error });
      } finally {
        try {
          out.close();
        } catch {
          // already closed by a cancelled client
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
