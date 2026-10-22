"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { type Dictionary, fill, type Locale } from "@/i18n";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { isPasswordValid, NAME_MAX, safeReturnPath } from "@/lib/auth-rules";
import { loginPath } from "@/lib/urls";

import { PasswordInput, PasswordRules } from "./password-input";

type Mode = "sign-in" | "sign-up";

type AuthError = { status?: number; code?: string } | null | undefined;

/** Maps Better Auth errors to dictionary messages (never shows raw server text). */
export function authErrorMessage(error: AuthError, errors: Dictionary["auth"]["errors"]) {
  if (!error) return errors.generic;
  if (error.status === 429) return errors.tooMany;
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
      return errors.invalidCredentials;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return errors.emailTaken;
    case "WEAK_PASSWORD":
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return errors.weakPassword;
    case "INVALID_NAME":
      return errors.invalidName;
    case "INVALID_EMAIL":
      return errors.invalidEmail;
    case "EMAIL_NOT_VERIFIED":
      return errors.emailNotVerified;
    default:
      return errors.generic;
  }
}

/**
 * Sign-in and sign-up form for /{locale}/login and /{locale}/signup.
 * `?next=` is where the reader returns afterwards; it is validated
 * (same-site paths only) before use, so it can't redirect off-site.
 */
export function AuthForm({
  mode,
  locale,
  labels,
  googleEnabled,
  emailEnabled,
}: {
  mode: Mode;
  locale: Locale;
  labels: Dictionary["auth"];
  googleEnabled: boolean;
  /** Phase 7: sign-up must confirm the email before the first sign-in. */
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = safeReturnPath(rawNext, `/${locale}`);
  const session = useSession();

  const [error, setError] = useState<string | null>(searchParams.get("error") ? labels.errors.google : null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";
  const passThroughNext = rawNext ? next : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (isSignUp && !isPasswordValid(password)) {
      setError(labels.errors.weakPassword);
      return;
    }

    setPending(true);
    // callbackURL only matters for the verification link (Phase 7); on sign-in it would force a full reload.
    const result = isSignUp
      ? await signUp.email({
          email,
          password,
          name: String(form.get("name") ?? "").trim(),
          ...(emailEnabled ? { callbackURL: next } : {}),
        })
      : await signIn.email({ email, password });

    if (result.error) {
      setError(authErrorMessage(result.error, labels.errors));
      setPending(false);
      return;
    }
    if (isSignUp && emailEnabled && !result.data?.token) {
      setVerifyEmail(email);
      setPending(false);
      return;
    }
    // No return page given: land on the homepage in the reader's preferred language.
    const preferred = (result.data?.user as { preferredLocale?: unknown } | undefined)?.preferredLocale;
    const destination = !rawNext && (preferred === "en" || preferred === "ur") ? `/${preferred}` : next;
    // Admin pages use another root layout; a full load there, a client navigation elsewhere.
    if (destination.startsWith("/admin")) {
      window.location.assign(destination);
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: `${loginPath(locale, passThroughNext)}${passThroughNext ? "&" : "?"}error=google`,
    });
    if (error) {
      setError(labels.errors.google);
      setPending(false);
    }
  }

  if (verifyEmail) {
    return (
      <div className="space-y-4" role="status">
        <h1 className="text-2xl text-ivory">{labels.signUpTitle}</h1>
        <p className="text-grey">{fill(labels.verifySent, { email: verifyEmail })}</p>
        <Link href={loginPath(locale, passThroughNext)} className="text-sm text-gold hover:text-gold-soft">
          {labels.backToSignIn}
        </Link>
      </div>
    );
  }

  // Already signed in (e.g. the back button): offer to continue instead of a second sign-in.
  if (session.data && !pending) {
    return (
      <div className="space-y-4">
        <p className="text-ivory">{fill(labels.alreadySignedIn, { name: session.data.user.name })}</p>
        <Button asChild className="w-full hover:bg-gold-soft">
          <a href={next}>{labels.continue}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl text-ivory">{isSignUp ? labels.signUpTitle : labels.signInTitle}</h1>
        <p className="text-sm text-grey">{isSignUp ? labels.signUpIntro : labels.signInIntro}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name">{labels.name}</Label>
            <Input id="name" name="name" autoComplete="name" dir="auto" maxLength={NAME_MAX} required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">{labels.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">{labels.password}</Label>
            {!isSignUp && (
              <Link href={`/${locale}/forgot-password`} className="text-xs text-gold hover:text-gold-soft">
                {labels.forgotPassword}
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            labels={labels}
            value={password}
            onChange={setPassword}
            describedBy={isSignUp ? "password-rules" : undefined}
          />
          {isSignUp && <PasswordRules id="password-rules" password={password} labels={labels} />}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full hover:bg-gold-soft" disabled={pending || session.isPending}>
          {pending ? labels.pending : isSignUp ? labels.submitSignUp : labels.submitSignIn}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-grey-dim">
            <Separator className="flex-1" />
            {labels.or}
            <Separator className="flex-1" />
          </div>
          <Button type="button" variant="outline" className="w-full bg-transparent" onClick={onGoogle} disabled={pending}>
            {labels.google}
          </Button>
        </>
      )}

      <p className="text-center text-sm text-grey">
        {isSignUp ? labels.haveAccount : labels.noAccount}{" "}
        <Link
          href={loginPath(locale, passThroughNext, isSignUp ? "login" : "signup")}
          className="text-gold underline-offset-4 hover:text-gold-soft hover:underline"
        >
          {isSignUp ? labels.signInTitle : labels.createAccount}
        </Link>
      </p>
    </div>
  );
}
