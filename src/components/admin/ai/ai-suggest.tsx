"use client";

import { Check, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";

import type { SuggestKind } from "@/lib/ai/tasks";
import { slugify } from "@/lib/articles/slug";
import type { ArticleDoc } from "@/lib/content/document";
import { cn } from "@/lib/utils";

import type { TagValue } from "../editor/tag-input";
import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

type Locale = "en" | "ur";

export type SuggestContext = { title: string; excerpt: string; body: ArticleDoc | null };

const LABELS: Record<SuggestKind, { button: string; working: string; hint: string }> = {
  headlines: { button: "Suggest headlines", working: "Writing headline ideas…", hint: "Click one to use it as the title." },
  excerpt: { button: "Suggest excerpt", working: "Summarising the article…", hint: "Click to use it as the excerpt." },
  seoTitle: { button: "Suggest", working: "Writing an SEO title…", hint: "Click to use it." },
  seoDescription: { button: "Suggest", working: "Writing an SEO description…", hint: "Click to use it." },
  tags: { button: "Suggest tags", working: "Finding topics…", hint: "Click a tag to add it. New tags are only created when you save." },
  slug: { button: "Suggest slug", working: "Shortening the slug…", hint: "Click to use it (it's still checked for availability)." },
};

/**
 * Small "✨ Suggest" control for one field. Suggestions are previews: nothing
 * changes until the admin clicks one.
 */
export function AiSuggest({
  kind,
  locale,
  getContext,
  onApply,
  onAddTag,
  chosenTags,
  disabledReason,
  className,
}: {
  kind: SuggestKind;
  locale: Locale;
  getContext: () => SuggestContext;
  onApply?: (value: string) => void;
  onAddTag?: (tag: TagValue) => void;
  chosenTags?: TagValue[];
  /** When set, the button is disabled and this is shown as its tooltip. */
  disabledReason?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const task = useAiTask<"suggest">();
  const label = LABELS[kind];
  const rtl = locale === "ur" && kind !== "slug" && kind !== "tags";

  const run = () => {
    setOpen(true);
    setApplied(null);
    const { title, excerpt, body } = getContext();
    void task.run({ task: "suggest", kind, locale, title, excerpt, body });
  };
  const close = () => {
    task.reset();
    setOpen(false);
  };

  const result = task.state.status === "done" ? task.state.result : null;
  const chosen = new Set((chosenTags ?? []).map((tag) => slugify(tag.nameEn, 60)));

  return (
    <div className={cn("space-y-2", className)} dir="ltr" lang="en">
      {!open && (
        <button
          type="button"
          onClick={run}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-gold hover:text-gold-soft disabled:cursor-not-allowed disabled:text-grey-dim"
        >
          <Sparkles aria-hidden className="size-3.5" />
          {label.button}
        </button>
      )}

      {open && (
        <div role="region" aria-label={label.button} className="space-y-2 rounded-md border border-gold-muted/50 bg-black/60 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs text-gold">
              <Sparkles aria-hidden className="size-3.5" /> AI suggestion{kind === "headlines" || kind === "tags" ? "s" : ""}
            </p>
            <button type="button" aria-label="Close suggestions" onClick={close} className="text-grey hover:text-ivory">
              <X className="size-4" />
            </button>
          </div>

          {task.state.status === "running" && <AiWorking label={label.working} onStop={close} />}
          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={run} />}
          {task.state.status === "stopped" && <p className="text-xs text-grey">Stopped.</p>}

          {result && result.options.length > 0 && (
            <ul className="space-y-1">
              {result.options.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => {
                      onApply?.(option);
                      setApplied(option);
                    }}
                    dir={rtl ? "rtl" : "ltr"}
                    lang={rtl ? "ur" : "en"}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm border border-border px-2 py-1.5 text-start text-sm text-ivory hover:border-gold-muted",
                      rtl && "font-urdu leading-loose",
                      applied === option && "border-gold-muted",
                    )}
                  >
                    {applied === option && <Check aria-label="Applied" className="mt-1 size-3.5 shrink-0 text-emerald-400" />}
                    <span className="min-w-0 flex-1 break-words">{option}</span>
                    {(kind === "seoTitle" || kind === "seoDescription" || kind === "excerpt") && (
                      <span dir="ltr" className="shrink-0 text-xs text-grey-dim">
                        {option.length}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {result?.tags && (
            <div className="flex flex-wrap gap-1.5">
              {[...result.tags.existing.map((tag) => ({ ...tag, isNew: false })), ...result.tags.new.map((nameEn) => ({ id: undefined, nameEn, nameUr: null, isNew: true }))].map((tag) => {
                const added = chosen.has(slugify(tag.nameEn, 60));
                return (
                  <button
                    key={tag.nameEn}
                    type="button"
                    disabled={added}
                    onClick={() => onAddTag?.({ id: tag.id, nameEn: tag.nameEn, nameUr: tag.nameUr })}
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-ivory hover:border-gold-muted disabled:opacity-50"
                  >
                    {added ? <Check aria-hidden className="size-3" /> : <Plus aria-hidden className="size-3" />}
                    {tag.nameEn}
                    {tag.isNew && <span className="text-grey-dim">(new)</span>}
                  </button>
                );
              })}
              {result.tags.existing.length + result.tags.new.length === 0 && <p className="text-xs text-grey">No tag ideas this time.</p>}
            </div>
          )}

          {result && <p className="text-xs text-grey-dim">{label.hint}</p>}
        </div>
      )}
    </div>
  );
}
