"use client";

import { RotateCcw } from "lucide-react";
import { Component, type ComponentType, lazy, type ReactNode, useMemo, useState } from "react";

/**
 * Keeps the article page safe from its reader AI panels: if a panel's code
 * fails to load (flaky connection) or the panel itself throws, only that
 * panel shows a friendly message with Retry; the article is untouched.
 */
export class PanelBoundary extends Component<
  { message: string; retryLabel: string; onRetry: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    console.warn("[reader-ai] panel failed");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-testid="panel-failed" className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-obsidian p-4 text-sm">
        <span className="text-destructive">{this.props.message}</span>
        <button
          type="button"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-border px-3 text-ivory hover:border-gold-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          {this.props.retryLabel}
        </button>
      </div>
    );
  }
}

/**
 * React.lazy remembers a failed import forever; this makes a fresh lazy
 * component for every retry so the chunk is fetched again.
 */
export function useRetryableLazy<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const [attempt, setAttempt] = useState(0);
  // `attempt` is the point: each retry needs a new lazy() instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const LazyComponent = useMemo(() => lazy(load), [attempt]);
  return [LazyComponent, () => setAttempt((n) => n + 1)] as const;
}
