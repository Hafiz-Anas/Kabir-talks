"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SOCIAL_EXAMPLES, SOCIAL_PLATFORM_NAMES, SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from "@/lib/social";
import { saveContactSettings, saveOpinionSettings, saveSocialSettings, type SettingsResult } from "@/server/settings-actions";

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

function SaveRow({ pending, result }: { pending: boolean; result: SettingsResult | null }) {
  return (
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
  );
}

/** Phase 7C: the disclaimer line at the end of opinion pieces. */
export function OpinionSettingsForm({ initial, defaults }: { initial: { disclaimerEn: string; disclaimerUr: string }; defaults: { disclaimerEn: string; disclaimerUr: string } }) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-md border border-border bg-obsidian p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveOpinionSettings(values);
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <label htmlFor={`${id}-en`} className="block text-sm text-ivory">
        Disclaimer (English)
      </label>
      <Textarea id={`${id}-en`} rows={2} maxLength={300} value={values.disclaimerEn} placeholder={defaults.disclaimerEn} onChange={(e) => setValues((v) => ({ ...v, disclaimerEn: e.target.value }))} />
      <label htmlFor={`${id}-ur`} className="block text-sm text-ivory">
        Disclaimer (Urdu)
      </label>
      <Textarea
        id={`${id}-ur`}
        rows={2}
        maxLength={300}
        dir="rtl"
        lang="ur"
        className="font-urdu leading-loose"
        value={values.disclaimerUr}
        placeholder={defaults.disclaimerUr}
        onChange={(e) => setValues((v) => ({ ...v, disclaimerUr: e.target.value }))}
      />
      <p className="text-xs text-grey">Shown at the end of every article in the Opinion category. Leave a field empty to use the default wording.</p>
      <SaveRow pending={pending} result={result} />
    </form>
  );
}

/** Phase 7C: the site's social profiles. Only filled-in links are shown on the site. */
export function SocialSettingsForm({ initial }: { initial: SocialLinks }) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState(() => Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, initial[p] ?? ""])) as Record<SocialPlatform, string>);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form
      className="space-y-4 rounded-md border border-border bg-obsidian p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveSocialSettings(values);
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} className="space-y-1.5">
            <label htmlFor={`${id}-${platform}`} className="block text-sm text-ivory">
              {SOCIAL_PLATFORM_NAMES[platform]}
            </label>
            <Input
              id={`${id}-${platform}`}
              type="url"
              dir="ltr"
              maxLength={500}
              placeholder={SOCIAL_EXAMPLES[platform]}
              value={values[platform]}
              aria-invalid={fieldErrors[platform] ? true : undefined}
              aria-describedby={fieldErrors[platform] ? `${id}-${platform}-error` : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [platform]: e.target.value }))}
            />
            {fieldErrors[platform] && (
              <p id={`${id}-${platform}-error`} className="text-xs text-destructive">
                {fieldErrors[platform]}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-grey">
        https links only, on each platform’s own domain. Empty links are hidden. Shown in the footer, the mobile menu, the About page and at the end of
        articles; the WhatsApp Channel also gets a “Follow on WhatsApp” button on articles and the homepage.
      </p>
      <SaveRow pending={pending} result={result} />
    </form>
  );
}
