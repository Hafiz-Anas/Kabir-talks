"use client";

import { CheckCircle2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Dictionary, fill, type Locale } from "@/i18n";
import { CONTACT_LIMITS, type ContactField } from "@/lib/contact";

type Labels = Dictionary["contact"];

/** Contact form (Phase 7). Part of the static page; the message is posted from the browser. */
export function ContactForm({ locale, labels }: { locale: Locale; labels: Labels }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [invalid, setInvalid] = useState<ContactField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setInvalid([]);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          subject: String(form.get("subject") ?? ""),
          message,
          locale,
          website: String(form.get("website") ?? ""),
        }),
      });
      if (response.ok) {
        setSent(true);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string; fields?: ContactField[] };
      if (body.fields?.length) setInvalid(body.fields);
      else setError(response.status === 429 ? labels.errors.rateLimited : labels.errors.generic);
    } catch {
      setError(labels.errors.generic);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-md border border-gold-muted/50 bg-obsidian p-5 text-ivory">
        <CheckCircle2 aria-hidden className="mt-1 size-5 shrink-0 text-gold" />
        {labels.sent}
      </p>
    );
  }

  const field = (name: ContactField) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": invalid.includes(name) || undefined,
    "aria-describedby": invalid.includes(name) ? `${id}-${name}-error` : undefined,
  });
  const fieldError = (name: ContactField) =>
    invalid.includes(name) ? (
      <p id={`${id}-${name}-error`} className="text-sm text-destructive">
        {labels.errors[name]}
      </p>
    ) : null;
  const labelClass = "text-sm text-ivory";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className={labelClass}>
            {labels.name}
          </label>
          <Input {...field("name")} required maxLength={CONTACT_LIMITS.name} autoComplete="name" />
          {fieldError("name")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-email`} className={labelClass}>
            {labels.email}
          </label>
          <Input {...field("email")} type="email" required maxLength={254} autoComplete="email" dir="ltr" className="text-start" />
          {fieldError("email")}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-subject`} className={labelClass}>
          {labels.subject}
        </label>
        <Input {...field("subject")} required maxLength={CONTACT_LIMITS.subject} />
        {fieldError("subject")}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-message`} className={labelClass}>
          {labels.message}
        </label>
        <Textarea
          {...field("message")}
          required
          rows={7}
          maxLength={CONTACT_LIMITS.message}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex justify-between gap-3">
          {fieldError("message") ?? <span />}
          <p className="text-xs text-grey" aria-live="polite">
            {CONTACT_LIMITS.message - message.length < 500 ? fill(labels.remaining, { count: CONTACT_LIMITS.message - message.length }) : ""}
          </p>
        </div>
      </div>

      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -start-[10000px] size-px overflow-hidden">
        <label htmlFor={`${id}-website`}>{labels.honeypot}</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div aria-live="polite" className="sr-only">
        {invalid.map((name) => labels.errors[name]).join(" ")}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="hover:bg-gold-soft">
        {pending ? labels.sending : labels.send}
      </Button>
    </form>
  );
}
