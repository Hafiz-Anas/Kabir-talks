"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AiResults, AiTaskInput, AiTaskName } from "@/lib/ai/tasks";

import { AiClientError, runAiTask } from "./ai-client";

export type AiTaskState<T extends AiTaskName> =
  | { status: "idle" }
  | { status: "running"; progress: { done: number; total: number } | null }
  | { status: "done"; result: AiResults[T] }
  | { status: "stopped" }
  | { status: "error"; error: AiClientError };

/**
 * Runs one AI task at a time with Stop support. Starting a new run, calling
 * stop(), or unmounting aborts the previous request (and its model call).
 * Nothing here touches the article: callers apply `result` only when the
 * admin clicks.
 */
export function useAiTask<T extends AiTaskName>(options: { onDelta?: (text: string) => void } = {}) {
  const [state, setState] = useState<AiTaskState<T>>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const lastInput = useRef<Extract<AiTaskInput, { task: T }> | null>(null);
  const onDelta = useRef(options.onDelta);
  useEffect(() => {
    onDelta.current = options.onDelta;
  });

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (input: Extract<AiTaskInput, { task: T }>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastInput.current = input;
    setState({ status: "running", progress: null });
    try {
      const result = await runAiTask<T>(input, {
        signal: current.signal,
        onDelta: (text) => onDelta.current?.(text),
        onProgress: (done, total) => {
          if (controller.current === current) setState({ status: "running", progress: { done, total } });
        },
      });
      if (controller.current === current) setState({ status: "done", result });
      return result;
    } catch (error) {
      if (controller.current !== current) return null;
      const aiError = error instanceof AiClientError ? error : new AiClientError("unknown");
      setState(aiError.code === "aborted" ? { status: "stopped" } : { status: "error", error: aiError });
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    controller.current?.abort();
    setState({ status: "stopped" });
  }, []);

  const retry = useCallback(() => (lastInput.current ? run(lastInput.current) : null), [run]);
  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, run, stop, retry, reset, running: state.status === "running" };
}
