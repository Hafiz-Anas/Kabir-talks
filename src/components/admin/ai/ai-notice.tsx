"use client";

import { AlertCircle, Loader2, RotateCcw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isRetryable } from "@/lib/ai/errors";
import { cn } from "@/lib/utils";

import type { AiClientError } from "./ai-client";

/** Friendly AI error with Retry. Always says the article wasn't changed. */
export function AiErrorNotice({ error, onRetry, className }: { error: AiClientError; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm", className)}>
      <p className="flex items-start gap-2 text-destructive">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {error.message} <span className="text-grey">Your article wasn&apos;t changed.</span>
        </span>
      </p>
      {onRetry && isRetryable(error.code) && (
        <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Retry
        </Button>
      )}
    </div>
  );
}

/** "Working…" line with a Stop button, for every long AI operation. */
export function AiWorking({ label, onStop, className }: { label: string; onStop: () => void; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center gap-3 text-sm text-grey", className)}>
      <Loader2 aria-hidden className="size-4 animate-spin text-gold" />
      <span className="flex-1">{label}</span>
      <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={onStop}>
        <Square aria-hidden className="fill-current" />
        Stop
      </Button>
    </div>
  );
}
