"use client";

import { Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type NewsletterActionResult,
  processNewsletterNow,
  removeSubscriber,
  sendArticleToSubscribers,
  sendWeeklyDigest,
} from "@/server/newsletter-actions";

/** Runs an action after an "Are you sure?" dialog, then shows its result. */
function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  run,
  destructive = false,
  size = "default",
  disabled = false,
  icon,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<NewsletterActionResult>;
  destructive?: boolean;
  size?: "default" | "sm" | "xs";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<NewsletterActionResult | null>(null);

  function confirm() {
    startTransition(async () => {
      const outcome = await run();
      setResult(outcome);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        variant={destructive ? "outline" : "default"}
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className={cn(destructive ? "bg-transparent text-destructive hover:text-destructive" : "hover:bg-gold-soft")}
      >
        {icon}
        {label}
      </Button>
      {result && (
        <p role="status" className={cn("text-sm", result.ok ? "text-gold" : "text-destructive")}>
          {result.ok ? result.message : result.error}
        </p>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-border bg-obsidian">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={cn(destructive ? "bg-destructive text-white hover:bg-destructive/90" : "hover:bg-gold-soft")}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function RemoveSubscriberButton({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmAction
      label="Remove"
      size="xs"
      destructive
      title={`Remove ${email}?`}
      description="This deletes the address and its history from the list. To stop emails but keep a record, ask them to use the unsubscribe link instead."
      confirmLabel="Remove"
      run={() => removeSubscriber(id)}
    />
  );
}

export function SendDigestButton({ week, recipients, alreadySent }: { week: string; recipients: number; alreadySent: boolean }) {
  return (
    <ConfirmAction
      label={alreadySent ? `Digest ${week} sent` : "Send this week’s digest"}
      disabled={alreadySent || recipients === 0}
      icon={<Send aria-hidden />}
      title={`Send the ${week} digest?`}
      description={`It goes to ${recipients} active subscriber${recipients === 1 ? "" : "s"} and can only be sent once per week.`}
      confirmLabel="Send digest"
      run={sendWeeklyDigest}
    />
  );
}

export function ProcessNowButton({ waiting }: { waiting: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="bg-transparent"
        disabled={pending || waiting === 0}
        onClick={() =>
          startTransition(async () => {
            const result = await processNewsletterNow();
            setMessage(result.ok ? result.message : result.error);
            router.refresh();
          })
        }
      >
        {pending ? "Sending…" : `Send next batch now${waiting ? ` (${waiting} waiting)` : ""}`}
      </Button>
      {message && (
        <p role="status" className="text-sm text-grey">
          {message}
        </p>
      )}
    </div>
  );
}

export type ArticleNewsletterStatus = {
  sent: { at: string; recipients: number; delivered: number; done: boolean } | null;
  eligible: number;
};

/** Editor side panel: send a published article to subscribers, once. */
export function ArticleNewsletterPanel({
  articleId,
  published,
  enabled,
  status,
}: {
  articleId: string | null;
  published: boolean;
  enabled: boolean;
  status: ArticleNewsletterStatus | null;
}) {
  if (!enabled) {
    return <p className="text-sm text-grey">Newsletter sending switches on once email is set up (RESEND_API_KEY and EMAIL_FROM).</p>;
  }
  if (status?.sent) {
    return (
      <p className="flex items-start gap-2 text-sm text-grey">
        <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
        <span>
          Sent to subscribers on {formatDateTime(status.sent.at)}: {status.sent.delivered} of {status.sent.recipients} delivered
          {status.sent.done ? "." : " so far."}
        </span>
      </p>
    );
  }
  if (!articleId || !published) {
    return <p className="text-sm text-grey">Publish the article first, then you can send it to newsletter subscribers.</p>;
  }
  const eligible = status?.eligible ?? 0;
  return (
    <div className="space-y-2">
      <p className="text-sm text-grey">
        {eligible === 0
          ? "No active subscribers read this article’s language yet."
          : `${eligible} active subscriber${eligible === 1 ? "" : "s"} will get it in their language.`}
      </p>
      <ConfirmAction
        label="Send to subscribers"
        size="sm"
        icon={<Send aria-hidden />}
        disabled={eligible === 0}
        title="Send this article to subscribers?"
        description={`It goes to ${eligible} subscriber${eligible === 1 ? "" : "s"}. An article can only be sent once, so check it first.`}
        confirmLabel="Send"
        run={() => sendArticleToSubscribers(articleId)}
      />
    </div>
  );
}
