"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Dictionary, type Locale, localeLabel, locales } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { NAME_MAX } from "@/lib/auth-rules";
import { isImageMime, MAX_IMAGE_BYTES } from "@/lib/uploads/file-type";
import { putToSignedUrl } from "@/lib/uploads/signed-put";
import { createAvatarUpload, finalizeAvatarUpload, removeAvatar, updateProfile } from "@/server/account-actions";

import { Avatar } from "./avatar";

type Labels = Dictionary["account"];

/** Name, profile photo and preferred language. Photo upload uses the Storage pipeline (same checks as article images). */
export function ProfileForm({
  initial,
  labels,
  storageEnabled,
}: {
  initial: { name: string; email: string; image: string | null; preferredLocale: Locale | null };
  labels: Labels;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [preferred, setPreferred] = useState<Locale | null>(initial.preferredLocale);
  const [image, setImage] = useState(initial.image);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  // The header avatar menu reads the session in the browser: tell it to refetch, and re-render this page.
  const refreshSession = () => {
    authClient.$store.notify("$sessionSignal");
    router.refresh();
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("saving");
    const result = await updateProfile({ name, preferredLocale: preferred });
    if (!result.ok) {
      setError(result.error === "invalid" ? labels.errors.invalidName : labels.errors.generic);
      setStatus("idle");
      return;
    }
    setStatus("saved");
    refreshSession();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!isImageMime(file.type) || file.size > MAX_IMAGE_BYTES) {
      setError(labels.errors.photo);
      return;
    }
    setStatus("uploading");
    try {
      const start = await createAvatarUpload({ contentType: file.type, size: file.size });
      if (!start.ok) throw new Error(start.error);
      await putToSignedUrl(start.signedUrl, file);
      const done = await finalizeAvatarUpload({ path: start.path });
      if (!done.ok || !done.url) throw new Error(done.ok ? "photo" : done.error);
      setImage(done.url);
      refreshSession();
    } catch {
      setError(labels.errors.photo);
    } finally {
      setStatus("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemovePhoto() {
    setError(null);
    const result = await removeAvatar();
    if (!result.ok) return setError(labels.errors.generic);
    setImage(null);
    refreshSession();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={name.trim() || initial.name} image={image} size="lg" />
        <div className="space-y-2">
          <p className="text-sm text-ivory">{labels.photo}</p>
          {storageEnabled ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  disabled={status === "uploading"}
                  onClick={() => fileRef.current?.click()}
                >
                  {status === "uploading" ? labels.uploading : labels.uploadPhoto}
                </Button>
                {image && (
                  <Button type="button" variant="ghost" size="sm" onClick={onRemovePhoto} disabled={status === "uploading"}>
                    {labels.removePhoto}
                  </Button>
                )}
              </div>
              <p className="text-xs text-grey">{labels.photoHelp}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => onFile(event.target.files?.[0])}
              />
            </>
          ) : (
            <p className="max-w-sm text-xs text-grey">{labels.photoUnavailable}</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="display-name">{labels.displayName}</Label>
          <Input
            id="display-name"
            dir="auto"
            value={name}
            maxLength={NAME_MAX}
            required
            onChange={(event) => {
              setName(event.target.value);
              setStatus("idle");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{labels.email}</Label>
          <Input id="email" dir="ltr" value={initial.email} readOnly disabled />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ivory">{labels.language}</legend>
        <p className="text-xs text-grey">{labels.languageHelp}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {locales.map((value) => (
            <label
              key={value}
              lang={value}
              className="flex cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm text-ivory has-[:checked]:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="preferred-locale"
                value={value}
                checked={preferred === value}
                onChange={() => {
                  setPreferred(value);
                  setStatus("idle");
                }}
                className="accent-[var(--color-gold)]"
              />
              <span className={value === "ur" ? "font-urdu" : undefined}>{localeLabel[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" className="hover:bg-gold-soft" disabled={status === "saving"}>
          {status === "saving" ? labels.saving : labels.save}
        </Button>
        {status === "saved" && (
          <span role="status" className="text-sm text-gold-soft">
            {labels.saved}
          </span>
        )}
      </div>
    </form>
  );
}
