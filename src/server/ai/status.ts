import "server-only";

import type { ReaderAiStatus } from "@/lib/ai/reader";
import { features } from "@/lib/features";

import { getAudioStatuses } from "./audio";
import { getSummaryStatuses } from "./summaries";

/** Everything the editor's "Reader AI" side panel shows for one article. */
export async function getReaderAiStatus(articleId: string): Promise<ReaderAiStatus> {
  const summaries = await getSummaryStatuses(articleId);
  const audio = await getAudioStatuses(articleId);
  return { summaries, audio, storageEnabled: features.storageEnabled };
}
