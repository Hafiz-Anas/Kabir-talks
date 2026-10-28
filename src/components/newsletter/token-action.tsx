"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/i18n";

/**
 * Confirm / unsubscribe pages: the page itself is static; the token is read
 * from the address bar here and posted to the API once. A mail scanner that
 * only fetches the link (no JavaScript) therefore confirms nothing.
 */
export function TokenAction({
  action,
  locale,
  labels,
}: {
  action: "confirm" | "unsubscribe";
  locale: Locale;
  labels: { working: string; done: string; invalid: string; noToken: string; after?: string; backHome: string };
}) {
  const [state, setState] = useState<"working" | "done" | "invalid" | "missing">("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function run(): Promise<"done" | "invalid" | "missing"> {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) return "missing";
      // Keep the token out of the history and out of the Referer of any link clicked next.
      window.history.replaceState(null, "", window.location.pathname);
      const response = await fetch(`/api/newsletter/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return response.ok ? "done" : "invalid";
    }
    run().then(setState, () => setState("invalid"));
  }, [action]);

  const ok = state === "done";
  const message = { working: labels.working, done: labels.done, invalid: labels.invalid, missing: labels.noToken }[state];

  return (
    <div className="space-y-6" aria-live="polite">
      <p className="flex items-start gap-3 text-lg text-ivory" role={state === "invalid" || state === "missing" ? "alert" : undefined}>
        {ok && <CheckCircle2 aria-hidden className="mt-1 size-5 shrink-0 text-gold" />}
        {(state === "invalid" || state === "missing") && <XCircle aria-hidden className="mt-1 size-5 shrink-0 text-destructive" />}
        <span>{message}</span>
      </p>
      {ok && labels.after && <p className="text-grey">{labels.after}</p>}
      {state !== "working" && (
        <Link href={`/${locale}`} className="inline-block text-gold underline underline-offset-4 hover:text-gold-soft">
          {labels.backHome}
        </Link>
      )}
    </div>
  );
}
