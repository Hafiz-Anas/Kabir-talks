import "server-only";

import type { ReaderAiStatus } from "@/lib/ai/reader";

import { getSummaryStatuses } from "./summaries";

/** Everything the editor's "Reader AI" side panel shows for one article. */
export async function getReaderAiStatus(articleId: string): Promise<ReaderAiStatus> {
  return { summaries: await getSummaryStatuses(articleId) };
}
