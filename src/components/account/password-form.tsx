"use client";

import { type FormEvent, useState } from "react";

import { authErrorMessage } from "@/components/auth/auth-form";
import { PasswordInput, PasswordRules } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { isPasswordValid } from "@/lib/auth-rules";

/**
 * Change password (email/password accounts). Better Auth checks the current
 * password, enforces our rules (src/lib/auth.ts hook) and is rate limited;
 * other sessions are signed out.
 */
export function PasswordForm({ labels, authLabels }: { labels: Dictionary["account"]; authLabels: Dictionary["auth"] }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isPasswordValid(next)) return setError(authLabels.errors.weakPassword);
    setState("pending");
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (error) {
      setError(error.code === "INVALID_PASSWORD" ? labels.wrongPassword : authErrorMessage(error, authLabels.errors));
      setState("idle");
      return;
    }
    setCurrent("");
    setNext("");
    setState("done");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="current-password">{labels.currentPassword}</Label>
          <PasswordInput
            id="current-password"
            name="current-password"
            autoComplete="current-password"
            labels={authLabels}
            value={current}
            onChange={setCurrent}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{labels.newPassword}</Label>
          <PasswordInput
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            labels={authLabels}
            value={next}
            onChange={(value) => {
              setNext(value);
              setState("idle");
            }}
            describedBy="new-password-rules"
          />
          <PasswordRules id="new-password-rules" password={next} labels={authLabels} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {state === "done" && (
        <p role="status" className="text-sm text-gold-soft">
          {labels.passwordChanged}
        </p>
      )}
      <Button type="submit" variant="outline" className="bg-transparent" disabled={state === "pending"}>
        {state === "pending" ? authLabels.pending : labels.changePassword}
      </Button>
    </form>
  );
}
