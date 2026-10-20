"use client";

import { Languages } from "lucide-react";
import { useState } from "react";

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AiResults, TranslatableField } from "@/lib/ai/tasks";
import type { ArticleDoc } from "@/lib/content/document";

import { AiErrorNotice, AiWorking } from "./ai-notice";
import { useAiTask } from "./use-ai-task";

type Locale = "en" | "ur";
const NAME: Record<Locale, string> = { en: "English", ur: "Urdu" };

export type TranslateSource = Record<TranslatableField, string> & { body: ArticleDoc | null };

/**
 * "Translate to Urdu/English" for one tab. Asks before replacing anything in
 * the target language, shows progress with Stop, and hands the result to the
 * editor, which puts it in the target tab as unsaved changes to review.
 */
export function TranslateButton({
  from,
  to,
  getSource,
  targetHasContent,
  sourceHasContent,
  onApply,
}: {
  from: Locale;
  to: Locale;
  getSource: () => TranslateSource;
  targetHasContent: boolean;
  sourceHasContent: boolean;
  onApply: (result: AiResults["translate"]) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const task = useAiTask<"translate">();

  const execute = async () => {
    const { body, ...fields } = getSource();
    const result = await task.run({ task: "translate", from, to, fields, body });
    if (result) {
      onApply(result);
      setOpen(false);
      task.reset();
    }
  };

  const start = () => {
    setConfirm(false);
    setOpen(true);
    void execute();
  };

  const onClick = () => {
    setHint(null);
    if (!sourceHasContent) return setHint(`Write something in ${NAME[from]} first.`);
    if (targetHasContent) return setConfirm(true);
    start();
  };

  const close = () => {
    task.reset(); // aborts a running translation
    setOpen(false);
  };

  const progress = task.state.status === "running" ? task.state.progress : null;
  const label = progress && progress.total > 0
    ? `Translating to ${NAME[to]}: part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
    : `Translating to ${NAME[to]}…`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" dir="ltr" lang="en">
      {hint && <span className="text-xs text-grey">{hint}</span>}
      <Button type="button" variant="outline" size="sm" className="gap-2 bg-transparent" onClick={onClick}>
        <Languages aria-hidden className="text-gold" />
        Translate to {NAME[to]}
      </Button>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="border-border bg-obsidian">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">Replace the existing {NAME[to]} content?</AlertDialogTitle>
            <AlertDialogDescription>
              The {NAME[to]} tab already has content. Translating replaces its title, excerpt, SEO fields and body with
              the translation of the {NAME[from]} version (fields that are empty in {NAME[from]} are left alone). You
              can review everything before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={start}>Replace with translation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="border-border bg-obsidian" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ivory">
              <Languages aria-hidden className="size-5 text-gold" />
              Translate {NAME[from]} → {NAME[to]}
            </DialogTitle>
            <DialogDescription>
              Title, excerpt, SEO fields and body are translated together. Images, videos and posts stay where they are.
            </DialogDescription>
          </DialogHeader>

          {task.state.status === "running" && (
            <div className="space-y-3">
              <div
                role="progressbar"
                aria-label="Translation progress"
                aria-valuemin={0}
                aria-valuemax={progress?.total ?? 1}
                aria-valuenow={progress?.done ?? 0}
                className="h-1.5 overflow-hidden rounded-full bg-obsidian-raised"
              >
                <div
                  className="h-full bg-gold transition-[width]"
                  style={{ width: `${progress?.total ? Math.max(5, (progress.done / progress.total) * 100) : 5}%` }}
                />
              </div>
              <AiWorking label={label} onStop={close} />
            </div>
          )}
          {task.state.status === "error" && <AiErrorNotice error={task.state.error} onRetry={() => void execute()} />}

          <DialogFooter>
            {task.state.status !== "running" && (
              <Button type="button" variant="outline" className="bg-transparent" onClick={close}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
