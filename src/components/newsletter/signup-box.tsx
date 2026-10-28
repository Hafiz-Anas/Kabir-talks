"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary, Locale } from "@/i18n";
import { NEWSLETTER_LANGUAGE_OPTIONS, type NewsletterApiError, type NewsletterLanguage } from "@/lib/newsletter";
import { cn } from "@/lib/utils";

export type NewsletterLabels = Pick<
  Dictionary["newsletter"],
  | "title"
  | "description"
  | "shortDescription"
  | "emailLabel"
  | "emailPlaceholder"
  | "languageLabel"
  | "languages"
  | "submit"
  | "submitting"
  | "success"
  | "privacy"
  | "honeypot"
  | "errors"
>;

/**
 * Newsletter sign-up. The markup is the same for every visitor (it is part
 * of the static page); the request happens in the browser. Double opt-in:
 * success only means "check your inbox".
 *
 *  - "card": homepage box. "inline": end of an article. "footer": compact.
 */
export function SignupBox({
  locale,
  labels,
  variant = "card",
}: {
  locale: Locale;
  labels: NewsletterLabels;
  variant?: "card" | "inline" | "footer";
}) {
  const id = useId();
  const [language, setLanguage] = useState<NewsletterLanguage>(locale);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const compact = variant === "footer";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setState("pending");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? ""), language, locale, website: String(form.get("website") ?? "") }),
      });
      if (response.ok) {
        setState("done");
        return;
      }
      const code = ((await response.json().catch(() => ({}))) as { error?: NewsletterApiError }).error;
      setError(code === "invalid_email" ? labels.errors.invalidEmail : code === "rate_limited" ? labels.errors.rateLimited : labels.errors.generic);
    } catch {
      setError(labels.errors.generic);
    }
    setState("idle");
  }

  const Heading = variant === "footer" ? "p" : "h2";

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        variant === "card" && "rounded-md border border-gold-muted/40 bg-obsidian p-6 sm:p-8",
        variant === "inline" && "rounded-md border border-gold-muted/40 bg-obsidian p-5 sm:p-6",
        "space-y-4",
      )}
    >
      <div className={cn("flex items-start gap-4", compact && "gap-0")}>
        {!compact && (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-muted/60 text-gold">
            <Mail className="size-5" />
          </span>
        )}
        <div className="min-w-0 space-y-1.5">
          <Heading id={`${id}-title`} className={cn(compact ? "text-sm text-ivory" : "text-xl text-ivory sm:text-2xl")}>
            {labels.title}
          </Heading>
          <p className="text-sm text-grey">{compact ? labels.shortDescription : labels.description}</p>
        </div>
      </div>

      <div aria-live="polite">
        {state === "done" && (
          <p className="flex items-start gap-2 rounded-sm border border-gold-muted/50 bg-black/40 p-3 text-sm text-ivory">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
            {labels.success}
          </p>
        )}
      </div>

      {state !== "done" && (
        <form onSubmit={onSubmit} noValidate={false} className="space-y-3">
          <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
            <label htmlFor={`${id}-email`} className="sr-only">
              {labels.emailLabel}
            </label>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              placeholder={labels.emailPlaceholder}
              aria-invalid={error === labels.errors.invalidEmail || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-10 min-w-0 flex-1 bg-black/40 text-start placeholder:text-start"
            />
            <Button type="submit" disabled={state === "pending"} className="h-10 hover:bg-gold-soft">
              {state === "pending" ? labels.submitting : labels.submit}
            </Button>
          </div>

          <fieldset className="text-sm">
            {/* The legend names the group for screen readers; the visible label sits in the row so it follows RTL order. */}
            <legend className="sr-only">{labels.languageLabel}</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span aria-hidden className="text-grey">
                {labels.languageLabel}
              </span>
              {NEWSLETTER_LANGUAGE_OPTIONS.map((option) => (
                <label key={option} className="inline-flex cursor-pointer items-center gap-1.5 py-1 text-ivory">
                  <input
                    type="radio"
                    name={`${id}-language`}
                    value={option}
                    checked={language === option}
                    onChange={() => setLanguage(option)}
                    className="size-4 accent-[var(--kt-gold)]"
                  />
                  {labels.languages[option]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
          <div aria-hidden="true" className="absolute -start-[10000px] size-px overflow-hidden">
            <label htmlFor={`${id}-website`}>{labels.honeypot}</label>
            <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!compact && <p className="text-xs text-grey">{labels.privacy}</p>}
        </form>
      )}
    </section>
  );
}

