"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveContactSettings, type SettingsResult } from "@/server/settings-actions";

export function ContactSettingsForm({ initialEmail }: { initialEmail: string | null }) {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-md border border-border bg-obsidian p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveContactSettings({ email });
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <label htmlFor={id} className="text-sm text-ivory">
        Public contact email
      </label>
      <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" maxLength={254} dir="ltr" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="text-xs text-grey">
        Shown on the Contact page (both languages). Leave empty to show only the form. Form messages always go to the admin accounts.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} className="hover:bg-gold-soft">
          {pending ? "Saving…" : "Save"}
        </Button>
        {result && (
          <p role="status" className={cn("text-sm", result.ok ? "text-gold" : "text-destructive")}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  );
}
