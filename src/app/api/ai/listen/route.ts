import { type ListenResponse, summaryRequestSchema } from "@/lib/ai/reader";
import { speechParagraphs } from "@/lib/ai/speech";
import { features } from "@/lib/features";
import { currentAudio } from "@/server/ai/audio";
import { loadArticleSource } from "@/server/ai/summaries";
import { errorResponse, json } from "@/server/reader-api";

/**
 * GET /api/ai/listen?articleId=<uuid>&locale=en|ur
 *
 * What the Listen player plays, loaded when the reader presses Listen:
 * the generated audio if it matches the current text, otherwise the text
 * (title, then paragraphs; no images, embeds or captions) for the browser's
 * own voice. Read-only: readers can never trigger audio generation, which
 * only the admin can start from the editor.
 *
 * Only PUBLISHED articles with that language: anything else is 404.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = summaryRequestSchema.safeParse({ articleId: params.get("articleId"), locale: params.get("locale") });
  if (!parsed.success) return errorResponse("invalid", 400);
  if (!features.aiEnabled) return errorResponse("not_configured", 503);
  const source = await loadArticleSource(parsed.data.articleId, parsed.data.locale, { publishedOnly: true });
  if (!source) return errorResponse("not_found", 404);

  const audio = await currentAudio(source);
  const body: ListenResponse = audio
    ? { audio, speech: null }
    : { audio: null, speech: { paragraphs: speechParagraphs(source.text) } };
  return json(body);
}
