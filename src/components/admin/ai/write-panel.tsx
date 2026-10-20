"use client";

import { Plus, Sparkles } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { markdownToDoc } from "@/lib/ai/markdown";
import { DRAFT_LENGTHS, DRAFT_TONES, type DraftLength, type DraftTone } from "@/lib/ai/prompts";
import type { AiResults } from "@/lib/ai/tasks";
import { slugify } from "@/lib/articles/slug";
import { type ArticleDoc, countWords, docToPlainText } from "@/lib/content/document";
import { renderDocToHtml } from "@/lib/content/render";
import { cn } from "@/lib/utils";

import type { TagValue } from "../editor/tag-input";
import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

type Locale = "en" | "ur";
export type DraftApplyMode = "insert" | "replace" | "append";

export type DraftTarget = { bodyEmpty: boolean; title: string; excerpt: string };

const TONE_LABELS: Record<DraftTone, string> = { news: "News report", analysis: "Analysis", opinion: "Opinion", explainer: "Explainer" };
const LENGTH_LABELS: Record<DraftLength, string> = { short: "Short", medium: "Medium", long: "Long" };

export function WritePanel({
  open,
  onOpenChange,
  activeLocale,
  targets,
  chosenTags,
  onApply,
  onSetField,
  onAddTag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeLocale: Locale;
  targets: Record<Locale, DraftTarget>;
  chosenTags: TagValue[];
  /** Inserts the body (one undoable step); title/excerpt only when given (i.e. the field was empty). */
  onApply: (apply: { locale: Locale; mode: DraftApplyMode; doc: ArticleDoc; title?: string; excerpt?: string }) => void;
  onSetField: (locale: Locale, field: "title" | "excerpt", value: string) => void;
  onAddTag: (tag: TagValue) => void;
}) {
  const ids = { prompt: useId(), notes: useId(), tone: useId() };
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [locale, setLocale] = useState<Locale>(activeLocale);
  const [length, setLength] = useState<DraftLength>("medium");
  const [tone, setTone] = useState<DraftTone>("news");
  const [streamed, setStreamed] = useState("");
  const [runLocale, setRunLocale] = useState<Locale>(activeLocale);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  const task = useAiTask<"draft">({ onDelta: (text) => setStreamed((prev) => prev + text) });
  const result = task.state.status === "done" ? task.state.result : null;

  // Each time the panel opens with nothing in progress, default to the tab the admin is on.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && task.state.status !== "running" && !result) setLocale(activeLocale);
  }

  const deferred = useDeferredValue(streamed);
  const previewHtml = useMemo(() => {
    const doc = result?.doc ?? markdownToDoc(deferred, { source: "ai", imagePrefix: null }).doc;
    return renderDocToHtml(doc, { imagePrefix: null });
  }, [deferred, result]);
  const words = result ? countWords(docToPlainText(result.doc)) : countWords(deferred.replace(/[#>*_[\]()-]/g, " "));

  const generate = () => {
    if (prompt.trim().length < 3) return setValidation("Describe the article you want (at least a few words).");
    setValidation(null);
    setStreamed("");
    setRunLocale(locale);
    void task.run({ task: "draft", prompt, notes, locale, length, tone });
  };

  const target = targets[runLocale];
  const apply = (mode: DraftApplyMode, draft: AiResults["draft"]) => {
    onApply({
      locale: runLocale,
      mode,
      doc: draft.doc,
      title: !target.title.trim() && draft.title ? draft.title : undefined,
      excerpt: !target.excerpt.trim() && draft.excerpt ? draft.excerpt : undefined,
    });
    task.reset();
    setStreamed("");
    onOpenChange(false);
  };

  const chosenSlugs = new Set(chosenTags.map((tag) => slugify(tag.nameEn, 60)));
  const rtl = runLocale === "ur";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-border bg-obsidian p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-ivory">
            <Sparkles aria-hidden className="size-4 text-gold" />
            Write with AI
          </SheetTitle>
          <SheetDescription>
            The draft appears here first. Nothing goes into your article until you choose to insert it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor={ids.prompt}>What should the article be about?</Label>
            <Textarea
              id={ids.prompt}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="e.g. Write an article about Pakistan's series win against England"
              disabled={task.running}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={ids.notes}>Key facts and notes (optional)</Label>
            <Textarea
              id={ids.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={12_000}
              rows={4}
              placeholder="Paste facts, quotes, figures and sources the article must use. The AI is told to use only these and not to invent quotes, statistics, names or dates."
              disabled={task.running}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Segmented
              label="Language"
              value={locale}
              onChange={setLocale}
              disabled={task.running}
              options={[
                { value: "en", label: "English" },
                { value: "ur", label: "اردو", className: "font-urdu" },
              ]}
            />
            <Segmented
              label="Length"
              value={length}
              onChange={setLength}
              disabled={task.running}
              options={(Object.keys(DRAFT_LENGTHS) as DraftLength[]).map((value) => ({
                value,
                label: LENGTH_LABELS[value],
                title: `~${DRAFT_LENGTHS[value]} words`,
              }))}
            />
            <div className="space-y-1.5">
              <Label htmlFor={ids.tone}>Tone</Label>
              <select
                id={ids.tone}
                value={tone}
                onChange={(e) => setTone(e.target.value as DraftTone)}
                disabled={task.running}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm [&>option]:bg-obsidian"
              >
                {(Object.keys(DRAFT_TONES) as DraftTone[]).map((value) => (
                  <option key={value} value={value}>
                    {TONE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {validation && (
            <p role="alert" className="text-sm text-destructive">
              {validation}
            </p>
          )}

          {task.running ? (
            <AiWorking label="Writing…" onStop={task.stop} />
          ) : (
            <Button type="button" onClick={generate} className="w-full hover:bg-gold-soft">
              <Sparkles aria-hidden />
              {result || streamed ? "Generate again" : "Generate draft"}
            </Button>
          )}

          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => (setStreamed(""), void task.retry())} />}
          {task.state.status === "stopped" && (
            <p role="status" className="text-sm text-grey">
              Stopped. Nothing was added to your article.
            </p>
          )}

          {(streamed || result) && (
            <section aria-label="Draft preview" className="space-y-3">
              <div className="flex items-center justify-between text-xs text-grey">
                <span className="tracking-wide uppercase">Preview</span>
                <span>{words} words</span>
              </div>
              <div
                lang={runLocale}
                dir={rtl ? "rtl" : "ltr"}
                className={cn("kt-prose max-h-[45dvh] overflow-y-auto rounded-md border border-border bg-black p-4 text-base", rtl && "font-urdu")}
                // Safe: output of the sanitizing renderer only.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </section>
          )}

          {result && (
            <div className="space-y-4 rounded-md border border-gold-muted/60 p-3">
              {result.warnings.map((warning) => (
                <p key={warning} className="text-xs text-gold">
                  {warning}
                </p>
              ))}
              {result.removed.length > 0 && (
                <p className="text-xs text-grey">Removed from the AI output: {result.removed.join("; ")}.</p>
              )}

              <Suggestion
                label="Title"
                value={result.title}
                rtl={rtl}
                willFill={!target.title.trim()}
                onUse={() => onSetField(runLocale, "title", result.title)}
              />
              <Suggestion
                label="Excerpt"
                value={result.excerpt}
                rtl={rtl}
                willFill={!target.excerpt.trim()}
                onUse={() => onSetField(runLocale, "excerpt", result.excerpt)}
              />

              {(result.tags.existing.length > 0 || result.tags.new.length > 0) && (
                <div className="space-y-1.5">
                  <p className="text-xs tracking-wide text-grey uppercase">Suggested tags (click to add)</p>
                  <div className="flex flex-wrap gap-2">
                    {[...result.tags.existing.map((tag) => ({ ...tag, isNew: false })), ...result.tags.new.map((nameEn) => ({ id: undefined, nameEn, nameUr: null, isNew: true }))].map((tag) => {
                      const added = chosenSlugs.has(slugify(tag.nameEn, 60));
                      return (
                        <button
                          key={tag.nameEn}
                          type="button"
                          disabled={added}
                          onClick={() => onAddTag({ id: tag.id, nameEn: tag.nameEn, nameUr: tag.nameUr })}
                          className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-ivory hover:border-gold-muted disabled:opacity-50"
                        >
                          <Plus aria-hidden className="size-3" />
                          {tag.nameEn}
                          {tag.isNew && <span className="text-grey-dim">(new)</span>}
                          {added && <span className="sr-only">(added)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  onClick={() => apply("insert", result)}
                  disabled={!target.bodyEmpty}
                  title={target.bodyEmpty ? undefined : "The article body isn't empty: replace it or append below"}
                  className="hover:bg-gold-soft"
                >
                  Insert into editor
                </Button>
                <Button type="button" variant="outline" className="bg-transparent" disabled={target.bodyEmpty} onClick={() => setConfirmReplace(true)}>
                  Replace current content…
                </Button>
                <Button type="button" variant="outline" className="bg-transparent" disabled={target.bodyEmpty} onClick={() => apply("append", result)}>
                  Append below
                </Button>
              </div>
              <p className="text-xs text-grey-dim">
                Goes into the {runLocale === "en" ? "English" : "Urdu"} tab as one step: press Ctrl+Z in the editor to undo it.
              </p>
            </div>
          )}
        </div>

        <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
          <AlertDialogContent className="border-border bg-obsidian">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-ivory">Replace the current {runLocale === "en" ? "English" : "Urdu"} body?</AlertDialogTitle>
              <AlertDialogDescription>
                The existing body text is replaced by the AI draft. You can undo this with Ctrl+Z in the editor.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => result && apply("replace", result)}>Replace</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function Suggestion({ label, value, rtl, willFill, onUse }: { label: string; value: string; rtl: boolean; willFill: boolean; onUse: () => void }) {
  const [used, setUsed] = useState(false);
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs tracking-wide text-grey uppercase">Suggested {label.toLowerCase()}</p>
      <p dir={rtl ? "rtl" : "ltr"} className={cn("text-sm text-ivory", rtl && "font-urdu leading-loose")}>
        {value}
      </p>
      {willFill ? (
        <p className="text-xs text-grey-dim">The {label.toLowerCase()} is empty, so this will be filled in when you insert.</p>
      ) : (
        <Button type="button" size="xs" variant="outline" className="bg-transparent" disabled={used} onClick={() => (onUse(), setUsed(true))}>
          {used ? `${label} replaced` : `Use this ${label.toLowerCase()} instead`}
        </Button>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; className?: string; title?: string }[];
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex rounded-md border border-input p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            title={option.title}
            className={cn(
              "flex-1 cursor-pointer rounded-sm px-2 py-1 text-center text-sm text-grey has-[:checked]:bg-obsidian-raised has-[:checked]:text-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              option.className,
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
