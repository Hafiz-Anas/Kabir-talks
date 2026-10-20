"use client";

import { CheckCircle2, Plug, Sparkles } from "lucide-react";
import { useState } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";
import type { AiStatus } from "@/lib/ai/config";

import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

/** Dashboard card: Not configured / Mock mode / Gemini (model), with a one-request connection test. */
export function AiStatusCard({ status }: { status: AiStatus }) {
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
