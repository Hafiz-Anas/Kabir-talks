"use client";

import { MessageCircleQuestion, RotateCcw, Send, Square, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { fill, type Locale } from "@/i18n";
import {
  type AskEvent,
  type AskMessage,
  cleanQuestion,
  HISTORY_MAX_MESSAGES,
  QUESTION_MAX_CHARS,
  type ReaderAiError,
  type SummaryResponse,
} from "@/lib/ai/reader";
import { useSession } from "@/lib/auth-client";
import { loginPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { errorMessage, type ReaderAiLabels, responseError } from "./labels";

/**
 * "Ask this article" (lazy-loaded when the reader first opens it): a side
 * drawer on desktop, a bottom sheet on phones. Signed-in readers only.
 * Answers stream in and can be stopped. The conversation lives in this
 * component only: the last few messages go with each question, nothing is
 * saved anywhere, and closing the page forgets it. Answers are shown as
 * plain text, never as HTML.
 */

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  status?: "streaming" | "done" | "stopped" | "error";
  error?: ReaderAiError | "offline";
  /** The question this answer belongs to (for Retry). */
  question?: string;
};

const desktopQuery = "(min-width: 768px)";
const subscribeDesktop = (onChange: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export default function AskPanel({
  articleId,
  locale,
  labels,
  open,
  onOpenChange,
  returnFocusTo,
}: {
  articleId: string;
  locale: Locale;
  labels: ReaderAiLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Ask button: focus goes back to it when the panel closes (it isn't a Radix Trigger). */
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => true);
  const session = useSession();
  const rtl = locale === "ur";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        showCloseButton={false}
        dir={rtl ? "rtl" : "ltr"}
        data-testid="ask-panel"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
        className={cn(
          "gap-0 border-border bg-obsidian p-0",
          desktop
            ? "w-full sm:max-w-md rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left"
            : "h-[85dvh] rounded-t-lg",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-1">
            <SheetTitle className="flex items-center gap-2 text-xl text-ivory">
              <MessageCircleQuestion aria-hidden className="size-5 text-gold" />
              {labels.askTitle}
            </SheetTitle>
            <SheetDescription className="text-sm text-grey">{labels.askIntro}</SheetDescription>
          </div>
          <SheetClose
            aria-label={labels.close}
            className="grid size-9 shrink-0 place-items-center rounded-sm text-grey hover:text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </SheetClose>
        </div>

        {session.isPending ? (
          <div role="status" aria-busy className="space-y-3 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-obsidian-raised" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-obsidian-raised" />
          </div>
        ) : session.data?.user ? (
          <Conversation articleId={articleId} locale={locale} labels={labels} />
        ) : (
          <SignInPrompt locale={locale} labels={labels} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SignInPrompt({ locale, labels }: { locale: Locale; labels: ReaderAiLabels }) {
  const pathname = usePathname();
  // Back to this article with the panel open again (#ask).
  const next = `${pathname}#ask`;
  const linkClass =
    "flex h-10 flex-1 items-center justify-center rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  return (
    <div className="space-y-4 p-5" data-testid="ask-signin">
      <p className="text-ivory">{labels.askSignIn}</p>
      <div className="flex gap-3">
        <Link href={loginPath(locale, next)} className={cn(linkClass, "border border-gold-muted text-ivory hover:border-gold")}>
          {labels.signIn}
        </Link>
        <Link href={loginPath(locale, next, "signup")} className={cn(linkClass, "bg-gold text-black hover:bg-gold-soft")}>
          {labels.signUp}
        </Link>
      </div>
    </div>
  );
}

function Conversation({ articleId, locale, labels }: { articleId: string; locale: Locale; labels: ReaderAiLabels }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [starters, setStarters] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const counterId = useId();
  const streaming = messages.some((message) => message.status === "streaming");
  const length = cleanQuestion(draft).length;
  const tooLong = length > QUESTION_MAX_CHARS;

  // Starter questions come with the cached summary (never generated from here).
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/ai/summary?articleId=${articleId}&locale=${locale}`, { cache: "no-store", signal: abort.signal })
      .then((res) => (res.ok ? (res.json() as Promise<SummaryResponse>) : null))
      .then((data) => data?.status === "ready" && setStarters(data.summary.questions))
      .catch(() => undefined);
    return () => abort.abort();
  }, [articleId, locale]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const update = (id: number, change: Partial<Message> | ((message: Message) => Partial<Message>)) =>
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)));

  const ask = useCallback(
    async (raw: string, previous: Message[]) => {
      const question = cleanQuestion(raw);
      if (!question || question.length > QUESTION_MAX_CHARS) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;

      // Only completed exchanges are remembered, and only the last few.
      const history: AskMessage[] = previous
        .filter((m) => m.role === "user" || m.status === "done")
        .filter((m, i, list) => m.role === "assistant" || list[i + 1]?.role === "assistant")
        .slice(-HISTORY_MAX_MESSAGES)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 1900) }));

      const userId = nextId.current++;
      const answerId = nextId.current++;
      setMessages((list) => [
        ...list,
        { id: userId, role: "user", text: question },
        { id: answerId, role: "assistant", text: "", status: "streaming", question },
      ]);
      setDraft("");

      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ articleId, locale, question, history }),
          signal: current.signal,
        });
        if (!res.ok || !res.body) {
          const error = await responseError(res.clone());
          if (error === "ask_limit") {
            const body = (await res.json().catch(() => null)) as { limit?: number } | null;
            setLimit(body?.limit ?? 0);
          }
          update(answerId, { status: "error", error });
          return;
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AskEvent;
            if (event.type === "delta") update(answerId, (m) => ({ text: m.text + event.text }));
            else if (event.type === "done") update(answerId, (m) => ({ status: "done", text: event.replace ?? m.text.trim() }));
            else update(answerId, { status: "error", error: event.error });
          }
        }
        update(answerId, (m) => (m.status === "streaming" ? { status: "error", error: "error" } : {}));
      } catch {
        if (current.signal.aborted) update(answerId, { status: "stopped" });
        else update(answerId, { status: "error", error: "offline" });
      }
    },
    [articleId, locale],
  );

  const stop = () => controller.current?.abort();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!streaming && !tooLong) void ask(draft, messages);
  };
  const retry = (message: Message) => {
    const index = messages.findIndex((m) => m.id === message.id);
    const before = messages.slice(0, Math.max(0, index - 1));
    setMessages(before);
    void ask(message.question ?? "", before);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions text" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" data-testid="ask-log">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-grey">{labels.askEmpty}</p>
            {starters.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs tracking-wide text-gold uppercase">{labels.askSuggested}</p>
                <ul className="flex flex-col items-start gap-2" data-testid="ask-starters">
                  {starters.map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        disabled={limit !== null}
                        onClick={() => void ask(question, messages)}
                        className="rounded-sm border border-border px-3 py-1.5 text-start text-sm text-ivory transition-colors hover:border-gold-muted hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="ms-8 rounded-md bg-obsidian-raised px-3 py-2 text-ivory" data-testid="ask-question">
              <span className="sr-only">{labels.askYou}: </span>
              {message.text}
            </div>
          ) : (
            <div key={message.id} className="me-4 space-y-2" data-testid="ask-answer" data-status={message.status}>
              <p className="text-xs text-gold">{labels.askAi}</p>
              {message.text && <p className="whitespace-pre-wrap text-ivory">{message.text}</p>}
              {message.status === "streaming" && !message.text && (
                <p role="status" className="animate-pulse text-sm text-grey">
                  {labels.askThinking}
                </p>
              )}
              {message.status === "stopped" && <p className="text-xs text-grey">{labels.stopped}</p>}
              {message.status === "error" && (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-destructive" data-testid="ask-error">
                    {message.error === "ask_limit"
                      ? fill(labels.askLimit, { max: limit ?? 0 })
                      : message.error === "too_long"
                        ? fill(labels.askTooLong, { max: QUESTION_MAX_CHARS })
                        : errorMessage(message.error ?? "error", labels)}
                  </p>
                  {!["ask_limit", "resting", "not_found", "too_long", "unauthorized"].includes(message.error ?? "") && (
                    <button
                      type="button"
                      onClick={() => retry(message)}
                      className="inline-flex h-8 items-center gap-2 rounded-sm border border-border px-3 text-sm text-ivory hover:border-gold-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <RotateCcw aria-hidden className="size-3.5" />
                      {labels.retry}
                    </button>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-border px-5 py-4">
        <label htmlFor={inputId} className="sr-only">
          {labels.askLabel}
        </label>
        <textarea
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!streaming && !tooLong) void ask(draft, messages);
            }
          }}
          rows={2}
          maxLength={QUESTION_MAX_CHARS + 200}
          placeholder={labels.askPlaceholder}
          aria-describedby={counterId}
          aria-invalid={tooLong || undefined}
          disabled={limit !== null}
          data-testid="ask-input"
          className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-ivory placeholder:text-grey-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p id={counterId} className={cn("text-xs", tooLong ? "text-destructive" : "text-grey")} aria-live="polite">
            {tooLong
              ? fill(labels.askTooLong, { max: QUESTION_MAX_CHARS })
              : fill(labels.askRemaining, { count: QUESTION_MAX_CHARS - length })}
          </p>
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              data-testid="ask-stop"
              className="inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-sm text-ivory hover:border-gold-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Square aria-hidden className="size-3.5 fill-current" />
              {labels.stop}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!length || tooLong || limit !== null}
              data-testid="ask-send"
              className="inline-flex h-9 items-center gap-2 rounded-sm bg-gold px-4 text-sm text-black transition-colors hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              <Send aria-hidden className="size-3.5 rtl:-scale-x-100" />
              {labels.askSend}
            </button>
          )}
        </div>
        {limit !== null && (
          <p role="status" className="text-sm text-destructive" data-testid="ask-limit">
            {fill(labels.askLimit, { max: limit })}
          </p>
        )}
        <p className="text-xs text-grey">{labels.askNote}</p>
      </form>
    </div>
  );
}
