"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BREAKING_DEFAULT_HOURS, BREAKING_TEXT_MAX, type BreakingInput } from "@/lib/breaking";
import { cn } from "@/lib/utils";
import {
  type ArticlePickerOption,
  deleteBreaking,
  saveBreaking,
  searchPublishedArticles,
  setBreakingActive,
} from "@/server/breaking-actions";

export type BreakingState = "live" | "off" | "expired";

export type BreakingItem = {
  id: string;
  textEn: string | null;
  textUr: string | null;
  articleId: string | null;
  articleTitle: string | null;
  articlePublished: boolean;
  linkUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  expiresLabel: string | null;
  createdLabel: string;
  state: BreakingState;
};

const STATE_STYLE: Record<BreakingState, { label: string; className: string }> = {
  live: { label: "Live", className: "border-success/40 bg-success/10 text-success" },
  off: { label: "Off", className: "border-border bg-obsidian-raised text-grey" },
  expired: { label: "Expired", className: "border-gold-muted bg-gold/10 text-gold" },
};

export function BreakingManager({ items }: { items: BreakingItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BreakingItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<BreakingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} className="hover:bg-gold-soft">
          <Plus aria-hidden /> New breaking item
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-grey">No breaking news yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-obsidian" aria-label="Breaking news items">
          {items.map((item) => (
            <li key={item.id} data-breaking-row={item.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-sm border px-2 py-0.5 font-medium", STATE_STYLE[item.state].className)}>{STATE_STYLE[item.state].label}</span>
                  <span className="text-grey">Added {item.createdLabel}</span>
                  <span className="text-grey">{item.expiresLabel ? `· ${item.state === "expired" ? "Expired" : "Expires"} ${item.expiresLabel}` : "· No expiry"}</span>
                </div>
                {item.textEn ? <p className="text-ivory">{item.textEn}</p> : <p className="text-sm text-grey italic">No English text: hidden on the English site.</p>}
                {item.textUr ? (
                  <p lang="ur" dir="rtl" className="font-urdu leading-loose text-ivory">
                    {item.textUr}
                  </p>
                ) : (
                  <p className="text-sm text-grey italic">No Urdu text: hidden on the Urdu site.</p>
                )}
                <p className="text-xs text-grey">
                  {item.linkUrl ? (
                    <>
                      Link: <span dir="ltr">{item.linkUrl}</span>
                    </>
                  ) : item.articleId ? (
                    <>
                      Article: {item.articleTitle ?? "(deleted)"}
                      {!item.articlePublished && <span className="text-gold"> — not published, so no link is shown</span>}
                    </>
                  ) : (
                    "No link"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`on-${item.id}`} className="text-xs text-grey">
                  {item.isActive ? "On" : "Off"}
                </Label>
                <Switch
                  id={`on-${item.id}`}
                  checked={item.isActive}
                  disabled={pending}
                  aria-label={item.isActive ? "Switch off" : "Switch on"}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      const result = await setBreakingActive({ id: item.id, isActive: checked });
                      setError(result.ok ? null : result.error);
                      router.refresh();
                    })
                  }
                />
                <Button variant="ghost" size="icon-sm" aria-label="Edit item" onClick={() => setEditing(item)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete item" onClick={() => setDeleting(item)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-obsidian">
          {editing && (
            <BreakingForm
              key={editing === "new" ? "new" : editing.id}
              item={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="border-border bg-obsidian">
          <DialogHeader>
            <DialogTitle className="text-ivory">Delete this item?</DialogTitle>
            <DialogDescription>It disappears from the bar within about a minute. This can’t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!deleting) return;
                  const result = await deleteBreaking({ id: deleting.id });
                  setError(result.ok ? null : result.error);
                  setDeleting(null);
                  router.refresh();
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "YYYY-MM-DDTHH:mm" in the browser's time zone, for <input type="datetime-local">. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type LinkKind = "none" | "article" | "url";

function BreakingForm({ item, onClose, onSaved }: { item: BreakingItem | null; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const [textEn, setTextEn] = useState(item?.textEn ?? "");
  const [textUr, setTextUr] = useState(item?.textUr ?? "");
  const [linkKind, setLinkKind] = useState<LinkKind>(item?.linkUrl ? "url" : item?.articleId ? "article" : "none");
  const [url, setUrl] = useState(item?.linkUrl ?? "");
  const [article, setArticle] = useState<ArticlePickerOption | null>(
    item?.articleId ? { id: item.articleId, titleEn: item.articleTitle, titleUr: null } : null,
  );
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [expires, setExpires] = useState(item ? item.expiresAt !== null : true);
  const [expiresAt, setExpiresAt] = useState(() =>
    toLocalInput(item?.expiresAt ? new Date(item.expiresAt) : new Date(Date.now() + BREAKING_DEFAULT_HOURS * 3_600_000)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const at = new Date(expiresAt);
    if (expires && Number.isNaN(at.getTime())) {
      setErrors({ expiresAt: "Choose a date and time" });
      return;
    }
    const input: BreakingInput = {
      id: item?.id,
      textEn,
      textUr,
      link:
        linkKind === "article"
          ? { kind: "article", articleId: article?.id ?? "" }
          : linkKind === "url"
            ? { kind: "url", url: url.trim() }
            : { kind: "none" },
      isActive,
      expiresAt: expires ? at.toISOString() : null,
    };
    startTransition(async () => {
      const result = await saveBreaking(input);
      if (result.ok) return onSaved();
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">{item ? "Edit breaking item" : "New breaking item"}</DialogTitle>
        <DialogDescription>Leave a language empty to hide the bar on that language’s site.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Row label="Text (English)" htmlFor={`${id}-en`} error={errors.textEn} hint={`${textEn.length}/${BREAKING_TEXT_MAX}`}>
          <Textarea id={`${id}-en`} rows={2} maxLength={BREAKING_TEXT_MAX} value={textEn} onChange={(e) => setTextEn(e.target.value)} />
        </Row>
        <Row label="Text (Urdu)" htmlFor={`${id}-ur`} error={errors.textUr} hint={`${textUr.length}/${BREAKING_TEXT_MAX}`}>
          <Textarea
            id={`${id}-ur`}
            rows={2}
            maxLength={BREAKING_TEXT_MAX}
            dir="rtl"
            lang="ur"
            className="font-urdu leading-loose"
            value={textUr}
            onChange={(e) => setTextUr(e.target.value)}
          />
        </Row>

        <fieldset className="space-y-2">
          <legend className="text-sm text-ivory">Link</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["none", "No link"],
                ["article", "Article"],
                ["url", "Web link"],
              ] as const
            ).map(([kind, label]) => (
              <label key={kind} className="flex items-center gap-2">
                <input type="radio" name={`${id}-link`} value={kind} checked={linkKind === kind} onChange={() => setLinkKind(kind)} className="accent-gold" />
                {label}
              </label>
            ))}
          </div>
          {linkKind === "article" && <ArticlePicker value={article} onChange={setArticle} error={errors.articleId} />}
          {linkKind === "url" && (
            <Row label="Web address" htmlFor={`${id}-url`} error={errors.url}>
              <Input id={`${id}-url`} type="url" dir="ltr" placeholder="https://" maxLength={2000} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Row>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-active`}>Live (shown on the site)</Label>
          <Switch id={`${id}-active`} checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ivory">
            <input type="checkbox" checked={expires} onChange={(e) => setExpires(e.target.checked)} className="accent-gold" />
            Expire automatically
          </label>
          {expires && (
            <Row label="Expires at (your local time)" htmlFor={`${id}-exp`} error={errors.expiresAt}>
              <Input id={`${id}-exp`} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Row>
          )}
        </div>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="hover:bg-gold-soft">
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/** Search published articles by title and pick one. */
function ArticlePicker({ value, onChange, error }: { value: ArticlePickerOption | null; onChange: (value: ArticlePickerOption | null) => void; error?: string }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticlePickerOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const found = await searchPublishedArticles({ q: query });
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      {value && (
        <p className="text-sm text-ivory">
          Selected: <span className="text-gold">{value.titleEn ?? value.titleUr}</span>{" "}
          <button type="button" className="text-xs text-grey underline hover:text-ivory" onClick={() => onChange(null)}>
            Clear
          </button>
        </p>
      )}
      <Label htmlFor={id}>Search published articles</Label>
      <Input id={id} type="search" value={query} placeholder="Title in English or Urdu" onChange={(e) => setQuery(e.target.value)} />
      <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Matching articles">
        {results.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              aria-pressed={value?.id === option.id}
              onClick={() => onChange(option)}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-start text-sm hover:bg-obsidian-raised",
                value?.id === option.id ? "text-gold" : "text-ivory",
              )}
            >
              {option.titleEn ?? (
                <span lang="ur" dir="rtl" className="font-urdu">
                  {option.titleUr}
                </span>
              )}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="text-xs text-grey">No published articles match.</li>}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-xs text-grey tabular-nums">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
