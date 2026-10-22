"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { PasswordInput } from "@/components/auth/password-input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Dictionary, fill, type Locale } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { DELETE_CONFIRMATION } from "@/lib/auth-rules";
import { deleteAccount } from "@/server/account-actions";

/**
 * Delete account: the reader types the localized confirmation word (and
 * their password for email accounts). The server re-checks both.
 */
export function DeleteAccount({
  locale,
  hasPassword,
  labels,
  authLabels,
}: {
  locale: Locale;
  hasPassword: boolean;
  labels: Dictionary["account"];
  authLabels: Dictionary["auth"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = word.trim() === labels.deleteConfirmWord;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return setError(labels.errors.confirm);
    setError(null);
    setPending(true);
    const result = await deleteAccount({ confirm: DELETE_CONFIRMATION, password: hasPassword ? password : undefined });
    if (!result.ok) {
      setError(
        result.error === "password" ? labels.wrongPassword : result.error === "admin" ? labels.adminCannotDelete : labels.errors.generic,
      );
      setPending(false);
      return;
    }
    // The session cookie is gone: tell the header to re-read it, then leave the private page.
    authClient.$store.notify("$sessionSignal");
    router.replace(`/${locale}`);
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setWord("");
          setPassword("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{labels.deleteButton}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir={locale === "ur" ? "rtl" : "ltr"} className="border-border bg-obsidian">
        <form onSubmit={onSubmit} className="space-y-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">{labels.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-grey">{labels.deleteIntro}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-word">{fill(labels.deleteConfirmLabel, { word: labels.deleteConfirmWord })}</Label>
            <Input id="delete-word" value={word} onChange={(event) => setWord(event.target.value)} autoComplete="off" required />
          </div>
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="delete-password">{labels.deletePassword}</Label>
              <PasswordInput
                id="delete-password"
                name="delete-password"
                autoComplete="current-password"
                labels={authLabels}
                value={password}
                onChange={setPassword}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="bg-transparent">
              {labels.cancel}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending || !confirmed}>
              {pending ? labels.deleting : labels.deleteFinal}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
