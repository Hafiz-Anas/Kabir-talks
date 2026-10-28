"use client";

import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SitePageSlug } from "@/db/schema";
import { cn } from "@/lib/utils";
import { saveSitePage, type SavePageResult } from "@/server/pages-actions";

import { RichTextEditor } from "./editor/rich-text-editor";

/** Admin → Pages → edit: Privacy Policy or Terms of Use, English and Urdu, with the article editor. */
export function PageEditor({
  slug,
  initial,
}: {
  slug: SitePageSlug;
  initial: { titleEn: string; titleUr: string; bodyEn: JSONContent | null; bodyUr: JSONContent | null };
}) {
  const router = useRouter();
  const id = useId();
  const [titleEn, setTitleEn] = useState(initial.titleEn);
  const [titleUr, setTitleUr] = useState(initial.titleUr);
  const [bodyEn, setBodyEn] = useState<JSONContent | null>(initial.bodyEn);
  const [bodyUr, setBodyUr] = useState<JSONContent | null>(initial.bodyUr);
  const [result, setResult] = useState<SavePageResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const outcome = await saveSitePage({ slug, titleEn, titleUr, bodyEn, bodyUr });
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <section className="space-y-3" lang="en">
        <label htmlFor={`${id}-en`} className="text-sm text-ivory">
          English title
        </label>
        <Input id={`${id}-en`} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={120} required />
        <div className="rounded-md border border-border bg-obsidian">
          <RichTextEditor locale="en" label="English text" initialContent={initial.bodyEn} onChange={setBodyEn} uploadsEnabled={false} />
        </div>
      </section>

      <section className="space-y-3" lang="ur" dir="rtl">
        <label htmlFor={`${id}-ur`} className="font-urdu text-sm text-ivory">
          اردو عنوان
        </label>
        <Input id={`${id}-ur`} value={titleUr} onChange={(e) => setTitleUr(e.target.value)} maxLength={120} required className="font-urdu" />
        <div className="rounded-md border border-border bg-obsidian">
          <RichTextEditor locale="ur" label="Urdu text" initialContent={initial.bodyUr} onChange={setBodyUr} uploadsEnabled={false} />
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-border bg-black/90 py-4 backdrop-blur">
        <Button type="submit" disabled={pending} className="hover:bg-gold-soft">
          {pending ? "Saving…" : "Save and publish"}
        </Button>
        {result && (
          <p role="status" className={cn("text-sm", result.ok ? "text-gold" : "text-destructive")}>
            {result.ok
              ? `Saved. The public page is updated.${result.removed.length ? ` Removed: ${result.removed.join(", ")}.` : ""}`
              : result.error}
          </p>
        )}
      </div>
    </form>
  );
}
