"use client";

import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n";
import { cn } from "@/lib/utils";

import { PanelSkeleton } from "./panel-skeleton";
import type { ReaderAiLabels } from "./labels";

/**
 * The article's reader toolbar when AI is configured (Phase 6): Save, then
 * Summarise, Ask and Listen. This file is all the article page ships up
 * front; each feature's code and data load only when the reader clicks it,
 * and nothing is requested before that, so the page stays static and light.
 */
const SummaryPanel = lazy(() => import("./summary-panel"));
const AskPanel = lazy(() => import("./ask-panel"));

export const toolClass =
  "inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-sm text-ivory transition-colors hover:border-gold-muted hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-expanded:border-gold-muted aria-expanded:text-gold";

export function ReaderAiTools({
  articleId,
  locale,
  labels,
  bookmark,
  pending,
}: {
  articleId: string;
  locale: Locale;
  labels: ReaderAiLabels;
  /** The Save button (rendered by the server component). */
  bookmark: ReactNode;
  /** Tools not available yet, shown as "Coming soon" items. */
  pending?: ReactNode;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  // The panel's code loads on first open and stays loaded.
  const [askLoaded, setAskLoaded] = useState(false);
  const askButton = useRef<HTMLButtonElement>(null);

  // Back from sign-in (…#ask): reopen Ask, then drop the hash.
  useEffect(() => {
    if (location.hash !== "#ask") return;
    history.replaceState(history.state, "", location.pathname + location.search);
    const timer = setTimeout(() => {
      setAskLoaded(true);
      setAskOpen(true);
    });
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full space-y-4">
      <ul aria-label={labels.readerTools} className="flex flex-wrap items-center gap-2">
        <li className="flex flex-col gap-1">{bookmark}</li>
        <li>
          <button
            type="button"
            className={toolClass}
            aria-expanded={summaryOpen}
            aria-controls="ai-summary"
            data-testid="summarise-button"
            onClick={() => setSummaryOpen((open) => !open)}
          >
            <Sparkles aria-hidden className={cn("size-4", summaryOpen ? "text-gold" : "text-gold-muted")} />
            {labels.summarise}
          </button>
        </li>
        <li>
          <button
            type="button"
            className={toolClass}
            ref={askButton}
            aria-haspopup="dialog"
            aria-expanded={askOpen}
            data-testid="ask-button"
            onClick={() => {
              setAskLoaded(true);
              setAskOpen(true);
            }}
          >
            <MessageCircleQuestion aria-hidden className={cn("size-4", askOpen ? "text-gold" : "text-gold-muted")} />
            {labels.ask}
          </button>
        </li>
        {pending}
      </ul>

      {summaryOpen && (
        <Suspense fallback={<PanelSkeleton label={labels.summaryLoading} />}>
          <SummaryPanel articleId={articleId} locale={locale} labels={labels} onClose={() => setSummaryOpen(false)} />
        </Suspense>
      )}
      {askLoaded && (
        <Suspense fallback={null}>
          <AskPanel articleId={articleId} locale={locale} labels={labels} open={askOpen} onOpenChange={setAskOpen} returnFocusTo={askButton} />
        </Suspense>
      )}
    </div>
  );
}
