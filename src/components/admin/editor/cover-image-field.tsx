"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

import { ComingSoon } from "@/components/coming-soon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { UploadProgress } from "./rich-text-editor";
import { uploadImage } from "./upload-image";

export function CoverImageField({
  url,
  alt,
  onChange,
  uploadsEnabled,
  error,
}: {
  url: string | null;
  alt: string;
  onChange: (next: { url: string | null; alt: string }) => void;
  uploadsEnabled: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setProgress(0);
    try {
      const uploaded = await uploadImage(file, setProgress);
      onChange({ url: uploaded, alt });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!uploadsEnabled && !url) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border p-3 text-sm text-grey">
        Cover image
        <ComingSoon label="Storage not configured" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {url ? (
        <div className="overflow-hidden rounded-md border border-border">
          <Image src={url} alt={alt || "Cover image preview"} width={640} height={360} className="aspect-video w-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="grid aspect-video w-full place-items-center rounded-md border border-dashed border-gold-muted/60 text-sm text-grey transition-colors hover:border-gold hover:text-ivory"
        >
          Upload cover image
          <span className="block text-xs text-grey-dim">JPEG, PNG, WebP or AVIF · max 5 MB</span>
        </button>
      )}

      {progress !== null && <UploadProgress value={progress} />}
      {(uploadError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {uploadError ?? error}
        </p>
      )}

      {url && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="bg-transparent" disabled={!uploadsEnabled || progress !== null} onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ url: null, alt: "" })}>
            Remove
          </Button>
        </div>
      )}

      {url && (
        <div className="space-y-1.5">
          <Label htmlFor={altId}>Alt text (required)</Label>
          <Input
            id={altId}
            value={alt}
            maxLength={300}
            onChange={(e) => onChange({ url, alt: e.target.value })}
            placeholder="Describe the image"
            aria-invalid={!alt.trim() || undefined}
          />
        </div>
      )}
    </div>
  );
}
