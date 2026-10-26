"use client";

import { ArrowDown, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n";
import type { ReaderAiError, SummaryData, SummaryResponse } from "@/lib/ai/reader";

import { errorMessage, type ReaderAiLabels, responseError } from "./labels";
import { PanelSkeleton } from "./panel-skeleton";

/**
 * Summarise (lazy-loaded on first click). Reads the cached summary; if there
 * is none yet, asks the server to make it (once, however many readers click)
 * and polls while another request is still generating it. The summary is
 * plain text from the API, rendered as text: never as HTML.
 */

type State =
  | { phase: "loading"; preparing: boolean }
  | { phase: "ready"; summary: SummaryData }
  | { phase: "error"; error: ReaderAiError | "offline" };

const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

class Failure extends Error {
  constructor(readonly code: ReaderAiError | "offline") {
    super(code);
  }
}

async function request(url: string, init: RequestInit): Promise<SummaryResponse> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Failure("offline");
  }
  if (!res.ok) throw new Failure(await responseError(res));
  return (await res.json()) as SummaryResponse;
}

export default function SummaryPanel({
  articleId,
  locale,
  labels,
  onClose,
}: {
  articleId: string;
  locale: Locale;
  labels: ReaderAiLabels;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ phase: "loading", preparing: false });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const { signal } = current;
    const get = () => request(`/api/ai/summary?articleId=${articleId}&locale=${locale}`, { signal });
    const generate = () =>
      request("/api/ai/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId, locale }),
        signal,
      });

    setState({ phase: "loading", preparing: false });
    try {
      let data = await get();
      if (data.status === "missing") data = await generate();
      const giveUp = Date.now() + GIVE_UP_MS;
      while (data.status !== "ready") {
        if (Date.now() > giveUp) throw new Failure("unavailable");
        setState({ phase: "loading", preparing: true });
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        data = await get();
        if (data.status === "missing") data = await generate();
      }
      if (!signal.aborted) setState({ phase: "ready", summary: data.summary });
    } catch (error) {
      if (signal.aborted) return;
      setState({ phase: "error", error: error instanceof Failure ? error.code : "error" });
    }
  }, [articleId, locale]);

  useEffect(() => {
    // Fetching on mount is this panel's whole job: it only mounts when the reader clicks Summarise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => controller.current?.abort();
  }, [load]);

  if (state.phase === "loading") {
    return <PanelSkeleton label={state.preparing ? labels.summaryPreparing : labels.summaryLoading} />;
  }

  const readFull = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const body = document.getElementById("article-body");
    if (!body) return;
    event.preventDefault();
    body.setAttribute("tabindex", "-1");
    body.scrollIntoView({ behavior: "smooth", block: "start" });
    body.focus({ preventScroll: true });
  };

  return (
    <section
      id="ai-summary"
      aria-labelledby="ai-summary-title"
      data-testid="ai-summary"
      className="space-y-4 rounded-md border border-gold-muted/40 bg-obsidian p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="ai-summary-title" className="flex items-center gap-2 text-lg text-ivory">
          <Sparkles aria-hidden className="size-4 text-gold" />
          {labels.summaryTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.hide}
          className="grid size-8 place-items-center rounded-sm text-grey transition-colors hover:text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {state.phase === "ready" ? (
        <ul aria-live="polite" className="list-disc space-y-2 ps-5 text-ivory marker:text-gold" data-testid="ai-summary-bullets">
          {state.summary.bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      ) : (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive" data-testid="ai-summary-error">
            {errorMessage(state.error, labels)}
          </p>
          {state.error !== "resting" && state.error !== "not_found" && (
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-border px-3 text-sm text-ivory hover:border-gold-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              {labels.retry}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
        <p className="text-xs text-grey">{labels.note}</p>
        <a href="#article-body" onClick={readFull} className="inline-flex items-center gap-1.5 text-gold hover:text-gold-soft">
          {labels.readFull}
          <ArrowDown aria-hidden className="size-3.5" />
        </a>
      </div>
    </section>
  );
}
