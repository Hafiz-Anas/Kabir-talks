import "server-only";

import { refreshSummaries } from "./summaries";

/**
 * Reader AI upkeep after an admin publishes or saves a live article, run
 * through next/server `after` so publishing never waits for the model or
 * fails because of it. Every error is caught and logged by code only.
 */
export async function refreshReaderAi(articleId: string) {
  try {
    await refreshSummaries(articleId);
  } catch {
    console.warn("[ai] background refresh failed");
  }
}
