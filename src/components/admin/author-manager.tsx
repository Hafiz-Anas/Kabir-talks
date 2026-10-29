"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { AuthorPhoto } from "@/components/authors/author-photo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/articles/slug";
import { AUTHOR_BIO_MAX, type AuthorInput } from "@/lib/authors";
import { SOCIAL_EXAMPLES, SOCIAL_PLATFORM_NAMES, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social";
import { deleteAuthor, saveAuthor } from "@/server/author-actions";
import type { AdminAuthorRow } from "@/server/authors";

import { UploadProgress } from "./editor/rich-text-editor";
import { uploadImage } from "./editor/upload-image";

export function AuthorManager({ authors, uploadsEnabled }: { authors: AdminAuthorRow[]; uploadsEnabled: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminAuthorRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminAuthorRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} className="hover:bg-gold-soft">
          <Plus aria-hidden /> New author
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border bg-obsidian" aria-label="Authors">
        {authors.map((author) => (
          <li key={author.id} data-author-row={author.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <AuthorPhoto name={author.nameEn} photoUrl={author.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-ivory">
                {author.nameEn}{" "}
                {author.nameUr && (
                  <span lang="ur" dir="rtl" className="font-urdu text-grey">
                    {author.nameUr}
                  </span>
                )}
                {author.isDefault && <span className="ms-2 rounded-sm border border-gold-muted px-1.5 text-xs text-gold">Main author</span>}
              </p>
              <p className="text-xs text-grey-dim" dir="ltr">
                /author/{author.slug}
                {author.titleEn ? ` · ${author.titleEn}` : ""}
              </p>
            </div>
            <span className="text-sm text-grey">
              {author.articleCount} article{author.articleCount === 1 ? "" : "s"}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${author.nameEn}`} onClick={() => setEditing(author)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${author.nameEn}`} onClick={() => setDeleting(author)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-obsidian sm:max-w-2xl">
          {editing && (
            <AuthorForm
              key={editing === "new" ? "new" : editing.id}
              author={editing === "new" ? null : editing}
              uploadsEnabled={uploadsEnabled}
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
          {deleting && (
            <DeleteAuthorForm
              key={deleting.id}
              author={deleting}
              others={authors.filter((a) => a.id !== deleting.id)}
              onClose={() => setDeleting(null)}
              onDeleted={() => {
                setDeleting(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormValues = Omit<AuthorInput, "socialLinks"> & { socialLinks: Record<SocialPlatform, string> };

function AuthorForm({
  author,
  uploadsEnabled,
  onClose,
  onSaved,
}: {
  author: AdminAuthorRow | null;
  uploadsEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<FormValues>(() => ({
    id: author?.id,
    nameEn: author?.nameEn ?? "",
    nameUr: author?.nameUr ?? "",
    slug: author?.slug ?? "",
    titleEn: author?.titleEn ?? "",
    titleUr: author?.titleUr ?? "",
    bioEn: author?.bioEn ?? "",
    bioUr: author?.bioUr ?? "",
    photoUrl: author?.photoUrl ?? null,
    isDefault: author?.isDefault ?? false,
    socialLinks: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, author?.socialLinks[p] ?? ""])) as Record<SocialPlatform, string>,
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(author));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  async function upload(file: File | undefined) {
    if (!file) return;
    setErrors((prev) => ({ ...prev, photoUrl: "" }));
    setProgress(0);
    try {
      set("photoUrl", await uploadImage(file, setProgress));
    } catch (error) {
      setErrors((prev) => ({ ...prev, photoUrl: error instanceof Error ? error.message : "Upload failed." }));
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const text = (key: "nameUr" | "titleEn" | "titleUr", label: string, urdu = false, max = 100) => (
    <Row label={label} htmlFor={`${id}-${key}`} error={errors[key]}>
      <Input
        id={`${id}-${key}`}
        value={values[key] ?? ""}
        maxLength={max}
        onChange={(e) => set(key, e.target.value)}
        {...(urdu ? { dir: "rtl", lang: "ur", className: "font-urdu leading-loose" } : {})}
      />
    </Row>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">{author ? `Edit ${author.nameEn}` : "New author"}</DialogTitle>
        <DialogDescription>Leave Urdu fields empty to show the English ones on the Urdu site.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await saveAuthor(values);
            if (result.ok) return onSaved();
            setErrors(result.fieldErrors ?? {});
            setFormError(result.error);
          });
        }}
      >
        <div className="flex items-center gap-4">
          <AuthorPhoto name={values.nameEn || "?"} photoUrl={values.photoUrl ?? null} size={72} />
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="bg-transparent" disabled={!uploadsEnabled || progress !== null} onClick={() => fileRef.current?.click()}>
                {values.photoUrl ? "Replace photo" : "Upload photo"}
              </Button>
              {values.photoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set("photoUrl", null)}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-grey">{uploadsEnabled ? "Square works best. JPEG, PNG, WebP or AVIF · max 5 MB" : "Photo uploads need Storage (see README)."}</p>
            {progress !== null && <UploadProgress value={progress} />}
            {errors.photoUrl && (
              <p role="alert" className="text-xs text-destructive">
                {errors.photoUrl}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="Name (English)" htmlFor={`${id}-nameEn`} error={errors.nameEn}>
            <Input
              id={`${id}-nameEn`}
              value={values.nameEn}
              maxLength={100}
              required
              onChange={(e) => {
                set("nameEn", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value, 80));
              }}
            />
          </Row>
          {text("nameUr", "Name (Urdu)", true)}
          {text("titleEn", "Role / title (English)")}
          {text("titleUr", "Role / title (Urdu)", true)}
        </div>
        <Row label="Slug (author page address)" htmlFor={`${id}-slug`} error={errors.slug}>
          <Input
            id={`${id}-slug`}
            dir="ltr"
            value={values.slug}
            maxLength={80}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
          />
        </Row>
        <Row label="Short bio (English)" htmlFor={`${id}-bioEn`} error={errors.bioEn}>
          <Textarea id={`${id}-bioEn`} rows={3} maxLength={AUTHOR_BIO_MAX} value={values.bioEn ?? ""} onChange={(e) => set("bioEn", e.target.value)} />
        </Row>
        <Row label="Short bio (Urdu)" htmlFor={`${id}-bioUr`} error={errors.bioUr}>
          <Textarea
            id={`${id}-bioUr`}
            rows={3}
            maxLength={AUTHOR_BIO_MAX}
            dir="rtl"
            lang="ur"
            className="font-urdu leading-loose"
            value={values.bioUr ?? ""}
            onChange={(e) => set("bioUr", e.target.value)}
          />
        </Row>

        <fieldset className="space-y-3">
          <legend className="text-sm text-ivory">Social links (optional, https only)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <Row key={platform} label={SOCIAL_PLATFORM_NAMES[platform]} htmlFor={`${id}-${platform}`} error={errors[platform]}>
                <Input
                  id={`${id}-${platform}`}
                  type="url"
                  dir="ltr"
                  placeholder={SOCIAL_EXAMPLES[platform]}
                  maxLength={500}
                  value={values.socialLinks[platform]}
                  onChange={(e) => setValues((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [platform]: e.target.value } }))}
                />
              </Row>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor={`${id}-default`}>Main author</Label>
            <p className="text-xs text-grey">Preselected for new articles. There is always exactly one.</p>
          </div>
          <Switch id={`${id}-default`} checked={values.isDefault ?? false} disabled={author?.isDefault} onCheckedChange={(checked) => set("isDefault", checked)} />
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
          <Button type="submit" disabled={pending || progress !== null} className="hover:bg-gold-soft">
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function DeleteAuthorForm({
  author,
  others,
  onClose,
  onDeleted,
}: {
  author: AdminAuthorRow;
  others: AdminAuthorRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const selectId = useId();
  const [target, setTarget] = useState(() => (others.find((a) => a.isDefault) ?? others[0])?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = author.articleCount;

  if (author.isDefault) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-ivory">“{author.nameEn}” is the main author</DialogTitle>
          <DialogDescription>Make another author the main one first (edit them and switch on “Main author”), then delete this one.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-ivory">Delete “{author.nameEn}”?</DialogTitle>
        <DialogDescription>
          {count === 0
            ? "This author has no articles. Deleting the profile can’t be undone."
            : `This author has ${count} article${count === 1 ? "" : "s"}. Reassign them to another author before deleting.`}
        </DialogDescription>
      </DialogHeader>
      {count > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={selectId}>Reassign the articles to</Label>
          <select
            id={selectId}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm [&>option]:bg-obsidian"
          >
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.nameEn}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={pending || (count > 0 && !target)}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAuthor({ id: author.id, reassignTo: count > 0 ? target : undefined });
              if (result.ok) return onDeleted();
              setError(result.error);
            })
          }
        >
          {count > 0 ? `Reassign ${count} and delete` : "Delete author"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Row({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
