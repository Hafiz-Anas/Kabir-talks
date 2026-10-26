import type { Dictionary } from "@/i18n";
import type { ReaderAiError } from "@/lib/ai/reader";

/** Every string the reader AI panels use (from the page's dictionary). */
export type ReaderAiLabels = Dictionary["readerAi"] & {
  summarise: string;
  ask: string;
  listen: string;
  readerTools: string;
  comingSoon: string;
  signIn: string;
  signUp: string;
};

export function readerAiLabels(dict: Dictionary): ReaderAiLabels {
  return {
    ...dict.readerAi,
    summarise: dict.article.summarise,
    ask: dict.article.ask,
    listen: dict.article.listen,
    readerTools: dict.article.readerTools,
    comingSoon: dict.common.comingSoon,
    signIn: dict.bookmarks.signIn,
    signUp: dict.bookmarks.signUp,
  };
}

/** A friendly message for each endpoint error (and for being offline). */
export function errorMessage(error: ReaderAiError | "offline", labels: ReaderAiLabels) {
  switch (error) {
    case "resting":
      return labels.resting;
    case "busy":
      return labels.busy;
    case "not_found":
    case "not_configured":
      return labels.notFound;
    case "unavailable":
      return labels.unavailable;
    case "offline":
      return labels.offline;
    default:
      return labels.error;
  }
}

/** Reads `{ error }` from a failed response; anything unexpected is "error". */
export async function responseError(res: Response): Promise<ReaderAiError> {
  const body = (await res.json().catch(() => null)) as { error?: ReaderAiError } | null;
  return body?.error ?? "error";
}
