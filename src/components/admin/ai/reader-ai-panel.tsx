"use client";

import { AudioLines, ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AudioStatus, ReaderAiStatus, ReaderLocale, SummaryStatus } from "@/lib/ai/reader";
import { refreshArticlePages } from "@/server/article-actions";
import { cn } from "@/lib/utils";

import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

/**
 * Editor side panel "Reader AI" (Phase 6): what readers get from the SAVED
 * article in each language — summary status, a preview, and Regenerate;
 * and the "Listen" audio, which only the admin can generate (it costs one
 * model call per ~1,800 characters). Live articles refresh their summaries
 * automatically after publishing and saving; audio is regenerated here.
 */

const LANGUAGES: { locale: ReaderLocale; name: string }[] = [
  { locale: "en", name: "English" },
  { locale: "ur", name: "Urdu" },
];

const AUDIO_LABEL: Record<AudioStatus["state"], string> = {
  ready: "Ready",
  stale: "Out of date",
  missing: "Not generated",
  unavailable: "Language incomplete",
  unsupported: "Not supported",
};

const STATE_LABEL: Record<SummaryStatus["state"], string> = {
  ready: "Ready",
  stale: "Out of date",
  missing: "Not generated",
  unavailable: "Language incomplete",
};

export function ReaderAiPanel({
  articleId,
  aiEnabled,
  initial,
  savedKey,
  dirty,
}: {
  articleId: string | null;
  aiEnabled: boolean;
  initial: ReaderAiStatus | null;
  /** Changes after every successful save: the panel reloads its status then. */
  savedKey: string;
  dirty: boolean;
}) {
  const [status, setStatus] = useState<ReaderAiStatus | null>(initial);
  const refresh = useAiTask<"reader-ai-status">();
  const firstKey = useRef(savedKey);
  const { run } = refresh;

  useEffect(() => {
    if (!articleId || !aiEnabled || savedKey === firstKey.current) return;
    firstKey.current = savedKey;
    void run({ task: "reader-ai-status", articleId }).then((result) => result && setStatus(result));
  }, [savedKey, articleId, aiEnabled, run]);

  if (!aiEnabled) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-grey">
        Summaries, Ask and Listen for readers
        <ComingSoon label="Not configured" />
      </div>
    );
  }
  if (!articleId) return <p className="text-sm text-grey">Save the article to manage its reader summaries.</p>;

  return (
    <div className="space-y-4" data-testid="reader-ai-panel">
      <p className="text-xs text-grey">
        Readers get these from the saved article. A published article’s summaries refresh automatically when its text
        changes.
      </p>
      {LANGUAGES.map(({ locale, name }) => (
        <SummaryRow
          key={locale}
          articleId={articleId}
          locale={locale}
          name={name}
          status={status?.summaries[locale] ?? null}
          dirty={dirty}
          onStatus={setStatus}
        />
      ))}
      {LANGUAGES.map(({ locale, name }) => (
        <AudioRow
          key={locale}
          articleId={articleId}
          locale={locale}
          name={name}
          status={status?.audio[locale] ?? null}
          storageEnabled={status?.storageEnabled ?? false}
          dirty={dirty}
          onStatus={setStatus}
        />
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-soft disabled:opacity-60"
        disabled={refresh.running}
        onClick={() => void refresh.run({ task: "reader-ai-status", articleId }).then((result) => result && setStatus(result))}
      >
        <RefreshCw aria-hidden className={cn("size-3.5", refresh.running && "animate-spin")} />
        Refresh status
      </button>
    </div>
  );
}

function SummaryRow({
  articleId,
  locale,
  name,
  status,
  dirty,
  onStatus,
}: {
  articleId: string;
  locale: ReaderLocale;
  name: string;
  status: SummaryStatus | null;
  dirty: boolean;
  onStatus: (status: ReaderAiStatus) => void;
}) {
  const task = useAiTask<"summary">();
  const state = status?.state ?? "missing";
  const summary = status?.summary;

  const generate = async () => {
    const result = await task.run({ task: "summary", articleId, locale });
    if (result) onStatus(result);
  };

  return (
    <section aria-label={`${name} summary`} data-testid={`summary-${locale}`} className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm text-ivory">
          <Sparkles aria-hidden className="size-3.5 text-gold" />
          {name} summary
        </h3>
        <span
          data-testid={`summary-${locale}-state`}
          data-state={state}
          className={cn("text-xs", state === "ready" ? "text-success" : state === "stale" ? "text-warning" : "text-grey")}
        >
          {STATE_LABEL[state]}
        </span>
      </div>

      {summary && (
        <Collapsible>
          <CollapsibleTrigger className="group inline-flex items-center gap-1 text-xs text-gold hover:text-gold-soft">
            <ChevronDown aria-hidden className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            Preview{state === "stale" ? " (previous version)" : ""}
          </CollapsibleTrigger>
          <CollapsibleContent
            lang={locale}
            dir={locale === "ur" ? "rtl" : "ltr"}
            className={cn("mt-2 space-y-2 rounded-sm bg-obsidian-raised/60 p-3 text-sm", locale === "ur" && "font-urdu")}
          >
            <ul className="list-disc space-y-1 ps-5" data-testid={`summary-${locale}-bullets`}>
              {summary.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            {summary.questions.length > 0 && (
              <p className="text-xs text-grey">
                <span dir="ltr" lang="en" className="font-sans">
                  Starter questions:{" "}
                </span>
                {summary.questions.join(" · ")}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {task.state.status === "running" ? (
        <AiWorking label={`Generating the ${name} summary…`} onStop={task.stop} />
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-transparent"
          disabled={state === "unavailable" || dirty}
          onClick={() => void generate()}
        >
          <RefreshCw aria-hidden />
          {state === "missing" ? "Generate summary" : "Regenerate summary"}
        </Button>
      )}
      {state === "unavailable" && <p className="text-xs text-grey">Add a {name} title and body, then save.</p>}
      {state !== "unavailable" && dirty && <p className="text-xs text-grey">Save your changes first: summaries use the saved article.</p>}
      {task.state.status === "stopped" && <p className="text-xs text-grey">Stopped waiting. The summary may still finish in the background.</p>}
      {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => void task.retry()} />}
    </section>
  );
}

const minutes = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function AudioRow({
  articleId,
  locale,
  name,
  status,
  storageEnabled,
  dirty,
  onStatus,
}: {
  articleId: string;
  locale: ReaderLocale;
  name: string;
  status: AudioStatus | null;
  storageEnabled: boolean;
  dirty: boolean;
  onStatus: (status: ReaderAiStatus) => void;
}) {
  const task = useAiTask<"audio">();
  const state = status?.state ?? "missing";
  const progress = task.state.status === "running" ? task.state.progress : null;

  const generate = async () => {
    const result = await task.run({ task: "audio", articleId, locale });
    if (!result) return;
    onStatus(result);
    // Let the static article page show (or keep showing) Listen with the new audio.
    await refreshArticlePages({ id: articleId }).catch(() => undefined);
  };

  return (
    <section aria-label={`${name} audio`} data-testid={`audio-${locale}`} className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm text-ivory">
          <AudioLines aria-hidden className="size-3.5 text-gold" />
          {name} audio
        </h3>
        <span
          data-testid={`audio-${locale}-state`}
          data-state={state}
          className={cn("text-xs", state === "ready" ? "text-success" : state === "stale" ? "text-warning" : "text-grey")}
        >
          {AUDIO_LABEL[state]}
        </span>
      </div>

      {state === "unsupported" ? (
        <p className="text-xs text-grey">
          Gemini text-to-speech doesn’t support {name}. {name} readers hear their browser’s own {name} voice when their
          device has one; otherwise the Listen button is hidden.
        </p>
      ) : !storageEnabled ? (
        <p className="text-xs text-grey">Audio files need Supabase Storage (see README → Supabase Storage).</p>
      ) : (
        <>
          {status?.url && (
            <div className="space-y-1">
              {/* Admin preview only: readers never get out-of-date audio. */}
              <audio controls preload="none" src={status.url} className="h-9 w-full" data-testid={`audio-${locale}-preview`} />
              <p className="text-xs text-grey">
                {status.durationMs !== null && minutes(status.durationMs)}
                {status.bytes !== null && ` · ${(status.bytes / 1024 / 1024).toFixed(1)} MB`}
                {state === "stale" && " · previous version"}
              </p>
            </div>
          )}
          {state === "stale" && (
            <p className="text-xs text-warning">The text changed since this audio was made. Readers won’t hear it until you regenerate it.</p>
          )}

          {task.state.status === "running" ? (
            <AiWorking
              label={progress && progress.total > 1 ? `Generating ${name} audio… part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : `Generating ${name} audio…`}
              onStop={task.stop}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-transparent"
              disabled={state === "unavailable" || dirty}
              onClick={() => void generate()}
            >
              <AudioLines aria-hidden />
              {state === "missing" ? "Generate audio" : "Regenerate audio"}
            </Button>
          )}
          {state === "unavailable" && <p className="text-xs text-grey">Add a {name} title and body, then save.</p>}
          {state !== "unavailable" && dirty && <p className="text-xs text-grey">Save your changes first: audio uses the saved article.</p>}
          {task.state.status === "stopped" && <p className="text-xs text-grey">Stopped. Nothing was saved.</p>}
          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => void task.retry()} />}
        </>
      )}
    </section>
  );
}
