"use client";

import { CheckCircle2, Plug, Sparkles } from "lucide-react";
import { useState } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";
import type { AiStatus } from "@/lib/ai/config";
import type { AiUsageToday } from "@/server/ai/limits";

import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

const FEATURE_LABELS: Record<keyof AiUsageToday["byFeature"], string> = {
  admin: "Editor AI (admin)",
  summary: "Summaries",
  ask: "Ask this article",
  listen: "Listen (audio)",
};

/**
 * Dashboard card: Not configured / Mock mode / Gemini (model), with a
 * one-request connection test, and today's usage against the daily cap.
 */
export function AiStatusCard({ status, usage }: { status: AiStatus; usage: AiUsageToday }) {
  const task = useAiTask<"ping">();
  const [tested, setTested] = useState(false);
  const result = task.state.status === "done" ? task.state.result : null;

  const label =
    status.mode === "off"
      ? "Not configured"
      : status.mode === "mock"
        ? "Mock mode"
        : result
          ? `Connected (${status.model})`
          : `Gemini (${status.model})`;

  return (
    <section aria-labelledby="ai-status" className="space-y-3 rounded-md border border-border bg-obsidian p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ai-status" className="flex items-center gap-2 text-xl text-ivory">
          <Sparkles aria-hidden className="size-5 text-gold" />
          AI status
        </h2>
        {status.mode === "off" ? (
          <ComingSoon label="Not configured" />
        ) : (
          <span data-testid="ai-status-label" className="inline-flex items-center gap-1.5 text-sm text-gold">
            {result && <CheckCircle2 aria-hidden className="size-4 text-emerald-400" />}
            {label}
          </span>
        )}
      </div>

      {status.mode === "off" && (
        <p className="text-sm text-grey">
          {status.reason} AI buttons show “Coming soon” until a key is added. See README → AI setup.
        </p>
      )}
      {status.mode === "mock" && (
        <p className="text-sm text-grey">
          AI_PROVIDER=mock: fake, deterministic responses for local development. No requests go to Google. (Disabled in
          production builds.)
        </p>
      )}
      {status.mode === "gemini" && !tested && (
        <p className="text-sm text-grey">A key is set. Use Test connection to check that it works (one tiny request).</p>
      )}

      {status.mode !== "off" && <UsageToday usage={usage} />}

      {status.mode !== "off" && (
        <div className="space-y-2">
          {task.state.status === "running" ? (
            <AiWorking label="Testing the connection…" onStop={task.stop} />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-transparent"
              onClick={() => {
                setTested(true);
                void task.run({ task: "ping" });
              }}
            >
              <Plug aria-hidden />
              Test connection
            </Button>
          )}
          {result && (
            <p role="status" className="text-sm text-emerald-400">
              Connected: {result.provider === "mock" ? "mock provider" : result.model} answered in {result.ms} ms.
            </p>
          )}
          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => void task.retry()} className="[&_span.text-grey]:hidden" />}
        </div>
      )}
    </section>
  );
}

function UsageToday({ usage }: { usage: AiUsageToday }) {
  const share = usage.cap > 0 ? Math.min(100, Math.round((usage.total / usage.cap) * 100)) : 100;
  const hours = Math.floor(usage.resetsInSeconds / 3600);
  const minutes = Math.floor((usage.resetsInSeconds % 3600) / 60);
  const resting = usage.total >= usage.cap;

  return (
    <div data-testid="ai-usage" className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <h3 className="text-ivory">Today’s AI usage</h3>
        <span className={resting ? "text-destructive" : "text-grey"}>
          <span data-testid="ai-usage-total" className="text-ivory tabular-nums">
            {usage.total}
          </span>{" "}
          of {usage.cap} model calls{resting ? " — resting until midnight" : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Share of today’s AI cap used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
        className="h-1.5 overflow-hidden rounded-full bg-obsidian-raised"
      >
        <div className={resting ? "h-full bg-destructive" : "h-full bg-gold"} style={{ inlineSize: `${share}%` }} />
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((feature) => (
          <li key={feature} className="flex justify-between gap-2">
            <span className="text-grey">{FEATURE_LABELS[feature]}</span>
            <span data-testid={`ai-usage-${feature}`} className="text-ivory tabular-nums">
              {usage.byFeature[feature]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-grey-dim">
        Daily cap AI_DAILY_LIMIT={usage.cap} (all features together); each reader may ask {usage.readerAskPerDay} questions a
        day (READER_AI_ASK_PER_DAY). Resets at midnight Pakistan time, in {hours}h {minutes}m.
      </p>
    </div>
  );
}
