"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { isValidSlug, SLUG_HELP, slugify } from "@/lib/articles/slug";
import { checkSlugAvailability } from "@/server/article-actions";

type Availability = "idle" | "checking" | "available" | "taken";

export function SlugField({
  value,
  onChange,
  articleId,
  publishedSlug,
  categorySlug,
  siteUrl,
  error,
}: {
  value: string;
  onChange: (value: string, touched: boolean) => void;
  articleId?: string;
  /** Slug at the time of the last publish (null if never published). */
  publishedSlug: string | null;
  categorySlug: string | null;
  siteUrl: string;
  error?: string;
}) {
  const id = useId();
  const [checked, setChecked] = useState<{ slug: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!isValidSlug(value)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkSlugAvailability({ slug: value, excludeId: articleId });
      if (!cancelled) setChecked({ slug: value, available: result.available });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, articleId]);

  const availability: Availability = !isValidSlug(value)
    ? "idle"
    : checked?.slug !== value
      ? "checking"
      : checked.available
        ? "available"
        : "taken";

  const formatError = value && !isValidSlug(value) ? SLUG_HELP : null;
  const changedAfterPublish = publishedSlug !== null && value !== publishedSlug;
  const host = siteUrl.replace(/^https?:\/\//, "");

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        URL slug
      </label>
      <Input
        id={id}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase(), true)}
        onBlur={(e) => {
          const cleaned = slugify(e.target.value);
          if (cleaned !== e.target.value) onChange(cleaned, true);
        }}
        aria-invalid={Boolean(formatError || error || availability === "taken") || undefined}
        aria-describedby={`${id}-help`}
        placeholder="auto-generated from the English title"
      />
      <p id={`${id}-help`} className="text-xs break-all text-grey-dim" dir="ltr">
        {host}/en/{categorySlug ?? "category"}/{value || "…"}
      </p>
      {(formatError || error) && (
        <p role="alert" className="text-xs text-destructive">
          {formatError ?? error}
        </p>
      )}
      {!formatError && !error && availability === "taken" && (
        <p role="alert" className="text-xs text-destructive">
          This slug is already used by another article.
        </p>
      )}
      {!formatError && !error && availability === "available" && <p className="text-xs text-emerald-400">Available</p>}
      {changedAfterPublish && (
        <p className="flex items-start gap-1.5 text-xs text-gold">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          This article was published as “{publishedSlug}”. Changing the slug breaks links that were already shared.
        </p>
      )}
    </div>
  );
}
