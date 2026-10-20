import { features } from "@/lib/features";
import { requireAdmin } from "@/lib/auth-guards";
import { AI_ERROR_MESSAGES, AiError } from "@/lib/ai/errors";
import { type AiEvent, aiTaskSchema } from "@/lib/ai/tasks";
import { handlers } from "@/server/ai/tasks";

/**
 * Admin-only AI endpoint. A route handler (not a server action) so the
 * response can stream and the admin's Stop button can cancel the request,
 * which aborts the model call.
 *
 * Errors before streaming starts use HTTP status codes; errors during a task
 * arrive as an NDJSON "error" event.
 */

const MAX_BODY_BYTES = 1_000_000;

function jsonError(status: number, code: AiError["code"], message = AI_ERROR_MESSAGES[code]) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  // Logged-out → redirect to /login; signed-in non-admin → 404.
  const session = await requireAdmin();

  if (!features.aiEnabled) return jsonError(503, "not_configured");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(413, "bad_request", "That's too much text for one AI request.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "bad_request");
  }
  const parsed = aiTaskSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "bad_request");
  const input = parsed.data;

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(stream) {
      const emit = (event: AiEvent) => {
        if (!controller.signal.aborted) stream.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const handler = handlers[input.task] as (i: typeof input, ctx: Parameters<(typeof handlers)["ping"]>[1]) => Promise<unknown>;
        const data = await handler(input, { userId: session.user.id, signal: controller.signal, emit });
        emit({ type: "result", data });
      } catch (error) {
        const aiError = error instanceof AiError ? error : new AiError("unknown");
        if (!(error instanceof AiError)) console.error("[ai] task failed", input.task, error instanceof Error ? error.name : "error");
        emit({ type: "error", code: aiError.code, message: aiError.message, retryAfter: aiError.retryAfter });
      } finally {
        try {
          stream.close();
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
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
