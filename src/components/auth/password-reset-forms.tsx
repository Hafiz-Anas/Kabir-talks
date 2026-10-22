"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary, Locale } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { isPasswordValid } from "@/lib/auth-rules";

import { authErrorMessage } from "./auth-form";
import { PasswordInput, PasswordRules } from "./password-input";

/**
 * "Forgot password?" and "Choose a new password". Only rendered when
 * features.authEmailEnabled is on (Phase 7); otherwise the pages show
 * <ComingSoon />.
 */

export function ForgotPasswordForm({ locale, labels }: { locale: Locale; labels: Dictionary["auth"] }) {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("pending");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: `/${locale}/reset-password` });
    // Same message whether or not the account exists (no account enumeration).
    if (error && error.status === 429) {
      setError(labels.errors.tooMany);
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-ivory">
        {labels.forgotSent}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full hover:bg-gold-soft" disabled={state === "pending"}>
        {state === "pending" ? labels.pending : labels.forgotSubmit}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ locale, labels }: { locale: Locale; labels: Dictionary["auth"] }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!token || searchParams.get("error")) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-ivory">
          {labels.resetInvalid}
        </p>
        <Link href={`/${locale}/forgot-password`} className="text-sm text-gold hover:text-gold-soft">
          {labels.forgotTitle}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPasswordValid(password)) {
      setError(labels.errors.weakPassword);
      return;
    }
    setError(null);
    setState("pending");
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    if (error) {
      setError(error.code === "INVALID_TOKEN" ? labels.resetInvalid : authErrorMessage(error, labels.errors));
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-ivory">{labels.resetDone}</p>
        <Link href={`/${locale}/login`} className="text-sm text-gold hover:text-gold-soft">
          {labels.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{labels.newPassword}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          labels={labels}
          value={password}
          onChange={setPassword}
          describedBy="password-rules"
        />
        <PasswordRules id="password-rules" password={password} labels={labels} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full hover:bg-gold-soft" disabled={state === "pending"}>
        {state === "pending" ? labels.pending : labels.resetSubmit}
      </Button>
    </form>
  );
}
