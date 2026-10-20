"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn, signUp } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"), "/en");

  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const { error } =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(form.get("name") ?? "").trim() });

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }

    // Server components re-read the new session cookie on refresh.
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error } = await signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      setError(error.message ?? "Google sign-in failed.");
      setPending(false);
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl text-ivory">{isSignUp ? "Create an account" : "Sign in"}</h1>
        <p className="text-sm text-grey">
          {isSignUp
            ? "Reader accounts are optional — reading is always free."
            : "Welcome back to Kabir Talks."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full hover:bg-gold-soft" disabled={pending}>
          {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-grey-dim">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full bg-transparent"
            onClick={onGoogle}
            disabled={pending}
          >
            Continue with Google
          </Button>
        </>
      )}

      <p className="text-center text-sm text-grey">
        {isSignUp ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? "sign-in" : "sign-up");
            setError(null);
          }}
          className="text-gold underline-offset-4 hover:text-gold-soft hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
