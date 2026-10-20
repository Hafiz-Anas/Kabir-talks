"use client";

import { NodeSelection } from "@tiptap/pm/state";
import type { Editor, JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Check, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { EditAction } from "@/lib/ai/prompts";
import { renderDocToHtml } from "@/lib/content/render";
import { cn } from "@/lib/utils";

import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

type Locale = "en" | "ur";

const ACTIONS: { action: EditAction; label: string }[] = [
  { action: "improve", label: "Improve writing" },
  { action: "grammar", label: "Fix grammar & spelling" },
  { action: "shorter", label: "Make shorter" },
  { action: "longer", label: "Make longer" },
  { action: "formal", label: "More formal" },
  { action: "simpler", label: "Simpler language" },
];

type Pending = { action: EditAction; label: string; from: number; to: number; original: string; inline: boolean };

/**
 * AI menu for selected text: a bubble menu with the edit actions, and a
 * review panel under the editor. Accepting replaces the selection in one
 * transaction (one Ctrl+Z); discarding leaves the article untouched.
 */
export function SelectionAi({
  editor,
  locale,
  imagePrefix,
  onAccepted,
}: {
  editor: Editor;
  locale: Locale;
  imagePrefix: string | null;
  onAccepted: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const task = useAiTask<"edit">();
  const result = task.state.status === "done" ? task.state.result : null;

  const start = (action: EditAction, label: string) => {
    const { from, to, $from, $to } = editor.state.selection;
    if (from === to) return;
    const slice = editor.state.doc.slice(from, to);
    const selection = { type: "doc", content: slice.content.toJSON() as JSONContent[] };
    // A selection inside one paragraph/heading is replaced inline, keeping the block around it.
    const inline = $from.sameParent($to) && $from.parent.isTextblock;
    setProblem(null);
    setPending({ action, label, from, to, original: editor.state.doc.textBetween(from, to, "\n"), inline });
    void task.run({ task: "edit", action, locale, selection });
  };

  const discard = () => {
    task.reset();
    setPending(null);
    setProblem(null);
  };

  const accept = () => {
    if (!pending || !result) return;
    const { from, to } = pending;
    const current = to <= editor.state.doc.content.size ? editor.state.doc.textBetween(from, to, "\n") : null;
    if (current !== pending.original) {
      setProblem("The text changed since you asked. Select it again and retry.");
      return;
    }
    const blocks = result.doc.content as JSONContent[];
    const content = pending.inline && blocks.length === 1 && blocks[0].type === "paragraph" ? (blocks[0].content ?? []) : blocks;
    editor.chain().focus().insertContentAt({ from, to }, content).run();
    onAccepted();
    discard();
  };

  const rtl = locale === "ur";

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: e, state, from, to }) =>
          e.isEditable && from !== to && !(state.selection instanceof NodeSelection) && !pending
        }
        options={{ placement: "top-start" }}
        className="z-40"
      >
        <div
          role="menu"
          aria-label="AI edit"
          dir="ltr"
          lang="en"
          className="flex max-w-[90vw] flex-wrap items-center gap-0.5 rounded-md border border-gold-muted/60 bg-obsidian p-1 shadow-lg"
        >
          <span className="flex items-center gap-1 px-1.5 text-xs text-gold">
            <Sparkles aria-hidden className="size-3.5" /> AI
          </span>
          {ACTIONS.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onMouseDown={(event) => event.preventDefault()} // keep the selection
              onClick={() => start(action, label)}
              className="rounded-sm px-2 py-1 text-xs text-ivory hover:bg-obsidian-raised hover:text-gold"
            >
              {label}
            </button>
          ))}
        </div>
      </BubbleMenu>

      {pending && (
        <div role="region" aria-label="AI edit suggestion" dir="ltr" lang="en" className="space-y-3 border-t border-gold-muted/50 bg-obsidian p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm text-gold">
              <Sparkles aria-hidden className="size-4" /> {pending.label}
            </p>
            <button type="button" aria-label="Discard suggestion" onClick={discard} className="text-grey hover:text-ivory">
              <X className="size-4" />
            </button>
          </div>

          {task.state.status === "running" && <AiWorking label="Rewriting the selection…" onStop={discard} />}
          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => void task.retry()} />}

          {result && (
            <>
              <div
                lang={locale}
                dir={rtl ? "rtl" : "ltr"}
                className={cn("kt-prose max-h-64 overflow-y-auto rounded-md border border-border bg-black p-3 text-base", rtl && "font-urdu")}
                // Safe: output of the sanitizing renderer only.
                dangerouslySetInnerHTML={{ __html: renderDocToHtml(result.doc, { imagePrefix }) }}
              />
              {result.removed.length > 0 && <p className="text-xs text-grey">Removed from the AI output: {result.removed.join("; ")}.</p>}
              {problem && (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={accept} className="hover:bg-gold-soft">
                  <Check aria-hidden />
                  Accept
                </Button>
                <Button type="button" size="sm" variant="outline" className="bg-transparent" onClick={discard}>
                  Discard
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
