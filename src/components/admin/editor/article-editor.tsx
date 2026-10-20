"use client";

import type { Editor, JSONContent } from "@tiptap/react";
import { ArrowLeft, ChevronDown, Eye, Languages, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { type DraftApplyMode, WritePanel } from "@/components/admin/ai/write-panel";
import { DeleteArticleDialog } from "@/components/admin/article-row-actions";
import { Checklist, PublishBlockedDialog } from "@/components/admin/publish-dialogs";
import { useShowPublished } from "@/components/admin/publish-success-provider";
import { StatusBadge } from "@/components/admin/status-badge";
import { ComingSoon } from "@/components/coming-soon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type ArticleStatus,
  type ChecklistItem,
  LIMITS,
  localeState,
  missingForPublish,
  publishChecklist,
  SEO_RECOMMENDED,
} from "@/lib/articles/rules";
import { slugify } from "@/lib/articles/slug";
import type { ArticlePayload, FieldErrors } from "@/lib/articles/validation";
import { type ArticleDoc, isDocEmpty, sanitizeDoc } from "@/lib/content/document";
import { cn } from "@/lib/utils";
import {
  archiveArticle,
  deleteArticle,
  publishArticle,
  saveArticle,
  unpublishArticle,
} from "@/server/article-actions";

import { CoverImageField } from "./cover-image-field";
import { RichTextEditor } from "./rich-text-editor";
import { SlugField } from "./slug-field";
import { TagInput, type TagValue } from "./tag-input";
import { useUnsavedChanges } from "./use-unsaved-changes";

export type EditorInitial = {
  id?: string;
  status: ArticleStatus;
  publishedAt: string | null;
  titleEn: string;
  titleUr: string;
  excerptEn: string;
  excerptUr: string;
  bodyEn: ArticleDoc | null;
  bodyUr: ArticleDoc | null;
  categoryId: string;
  slug: string;
  tags: TagValue[];
  coverImageUrl: string | null;
  coverImageAlt: string;
  isFeatured: boolean;
  seoTitleEn: string;
  seoTitleUr: string;
  seoDescriptionEn: string;
  seoDescriptionUr: string;
};

type Form = Omit<EditorInitial, "id" | "status" | "publishedAt" | "bodyEn" | "bodyUr"> & {
  bodyEn: JSONContent | null;
  bodyUr: JSONContent | null;
  slugTouched: boolean;
};

type Props = {
  initial: EditorInitial;
  categories: { id: string; slug: string; nameEn: string; nameUr: string }[];
  tagOptions: { id: string; slug: string; nameEn: string; nameUr: string | null }[];
  uploadsEnabled: boolean;
  imagePrefix: string | null;
  siteUrl: string;
  /** From features.aiEnabled (server). When false, AI buttons show "Coming soon". */
  aiEnabled: boolean;
};

type Locale = "en" | "ur";
const FIELD_KEYS = {
  title: { en: "titleEn", ur: "titleUr" },
  excerpt: { en: "excerptEn", ur: "excerptUr" },
} as const;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>option]:bg-obsidian";

export function ArticleEditor({ initial, categories, tagOptions, uploadsEnabled, imagePrefix, siteUrl, aiEnabled }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => ({
    ...initial,
    slugTouched: Boolean(initial.id),
  }));
  const [id, setId] = useState(initial.id);
  const [status, setStatus] = useState<ArticleStatus>(initial.status);
  const [publishedAt, setPublishedAt] = useState<string | null>(initial.publishedAt);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(initial.publishedAt ? initial.slug : null);

  const [saving, setSaving] = useState(false);
  const [busy, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState<ChecklistItem[] | null>(null);
  const showPublished = useShowPublished();
  const [slugConfirm, setSlugConfirm] = useState<null | (() => void)>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updatePublishedAt, setUpdatePublishedAt] = useState(false);
  const [tab, setTab] = useState<"en" | "ur">(initial.titleEn || !initial.titleUr ? "en" : "ur");

  const editors = useRef<{ en?: Editor; ur?: Editor }>({});

  const update = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Auto-slug from the English title until the slug is edited or the article has been published.
  const setTitleEn = (value: string) =>
    setForm((prev) => ({
      ...prev,
      titleEn: value,
      slug: !prev.slugTouched && !publishedSlug ? slugify(value) : prev.slug,
    }));

  const onBodyEn = useCallback((doc: JSONContent) => update("bodyEn", doc), [update]);
  const onBodyUr = useCallback((doc: JSONContent) => update("bodyUr", doc), [update]);
  const onReadyEn = useCallback((editor: Editor) => (editors.current.en = editor), []);
  const onReadyUr = useCallback((editor: Editor) => (editors.current.ur = editor), []);

  // ── AI ──────────────────────────────────────────────────────────────────
  const [writeOpen, setWriteOpen] = useState(false);
  /** Set whenever AI-written or AI-translated text enters the article (review safeguard). */
  const [, setAiInserted] = useState(false);
  const markAiContent = useCallback(() => setAiInserted(true), []);

  /** Sets a title/excerpt from AI; an English title also drives the auto-slug, like typing does. */
  const setAiField = useCallback(
    (locale: Locale, field: "title" | "excerpt", value: string) => {
      const key = FIELD_KEYS[field][locale];
      setForm((prev) => ({
        ...prev,
        [key]: value.slice(0, field === "title" ? LIMITS.title : LIMITS.excerpt),
        ...(key === "titleEn" && !prev.slugTouched && !publishedSlug ? { slug: slugify(value) } : {}),
      }));
      markAiContent();
    },
    [publishedSlug, markAiContent],
  );

  /** Puts AI content into a language's editor as ONE transaction, so a single Ctrl+Z undoes it. */
  const applyAiBody = useCallback(
    (locale: Locale, doc: ArticleDoc, mode: DraftApplyMode) => {
      const editor = editors.current[locale];
      if (!editor) return;
      setTab(locale);
      if (mode === "append") editor.chain().insertContentAt(editor.state.doc.content.size, doc.content).run();
      else editor.chain().setContent(doc).run();
      requestAnimationFrame(() => editor.commands.focus("end"));
      markAiContent();
    },
    [markAiContent],
  );

  const addTag = useCallback((tag: TagValue) => {
    setForm((prev) => {
      const slug = slugify(tag.nameEn, 60);
      if (prev.tags.length >= LIMITS.tags || prev.tags.some((t) => slugify(t.nameEn, 60) === slug)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }, []);

  const toPayload = useCallback(
    (source: Form): ArticlePayload => ({
      id,
      titleEn: source.titleEn,
      titleUr: source.titleUr,
      excerptEn: source.excerptEn,
      excerptUr: source.excerptUr,
      bodyEn: sanitizeDoc(source.bodyEn, { imagePrefix }).doc,
      bodyUr: sanitizeDoc(source.bodyUr, { imagePrefix }).doc,
      categoryId: source.categoryId,
      slug: source.slug,
      tags: source.tags.map((tag) => (tag.id ? { id: tag.id } : { name: tag.nameEn })),
      coverImageUrl: source.coverImageUrl,
      coverImageAlt: source.coverImageAlt,
      isFeatured: source.isFeatured,
      seoTitleEn: source.seoTitleEn,
      seoTitleUr: source.seoTitleUr,
      seoDescriptionEn: source.seoDescriptionEn,
      seoDescriptionUr: source.seoDescriptionUr,
    }),
    [id, imagePrefix],
  );

  // Dirty tracking compares sanitized payloads, so editor-only attributes don't count as changes.
  const snapshotOf = useCallback((source: Form) => JSON.stringify({ ...toPayload(source), id: undefined }), [toPayload]);
  const snapshot = useMemo(() => snapshotOf(form), [form, snapshotOf]);
  const [lastSaved, setLastSaved] = useState(snapshot);
  const dirty = snapshot !== lastSaved;
  useUnsavedChanges(dirty);

  const readiness = useMemo(() => {
    const payload = toPayload(form);
    return {
      categoryId: form.categoryId,
      slug: form.slug || slugify(form.titleEn),
      en: { title: form.titleEn, body: payload.bodyEn as ArticleDoc | null },
      ur: { title: form.titleUr, body: payload.bodyUr as ArticleDoc | null },
      coverImageUrl: form.coverImageUrl,
      coverImageAlt: form.coverImageAlt,
    };
  }, [form, toPayload]);
  const checklist = publishChecklist(readiness);

  // Latest save(), for the keyboard shortcut and the slug-change confirmation.
  const saveRef = useRef<(options?: { confirmSlugChange?: boolean }) => Promise<unknown>>(async () => null);

  const save = useCallback(
    async (options: { confirmSlugChange?: boolean } = {}) => {
      setSaving(true);
      setErrors({});
      setFormError(null);
      setNotice(null);
      const submitted = form;
      try {
        const result = await saveArticle({ ...toPayload(submitted), confirmSlugChange: options.confirmSlugChange });
        if (!result.ok) {
          if (result.needsSlugConfirm) {
            setSlugConfirm(() => () => void saveRef.current({ confirmSlugChange: true }));
          } else {
            setErrors(result.fieldErrors ?? {});
            setFormError(result.error);
            if (result.missing) setMissing(result.missing);
          }
          return null;
        }

        const saved = result.article;
        const patched: Form = {
          ...submitted,
          slug: saved.slug,
          slugTouched: true,
          tags: saved.tags.map((tag) => ({ id: tag.id, nameEn: tag.nameEn, nameUr: tag.nameUr })),
          bodyEn: result.removed.en.length ? saved.bodyEn : submitted.bodyEn,
          bodyUr: result.removed.ur.length ? saved.bodyUr : submitted.bodyUr,
        };
        setForm((prev) => ({
          ...prev,
          slug: prev.slug === submitted.slug ? patched.slug : prev.slug,
          slugTouched: true,
          tags: prev.tags === submitted.tags ? patched.tags : prev.tags,
        }));
        for (const locale of ["en", "ur"] as const) {
          if (result.removed[locale].length) editors.current[locale]?.commands.setContent(saved[locale === "en" ? "bodyEn" : "bodyUr"] ?? "");
        }
        setLastSaved(snapshotOf(patched));
        setStatus(saved.status);
        setPublishedAt(saved.publishedAt);
        if (saved.publishedAt) setPublishedSlug(saved.slug);

        const removed = [...result.removed.en.map((r) => `English: ${r}`), ...result.removed.ur.map((r) => `Urdu: ${r}`)];
        if (removed.length) setNotice(`Saved. Unsupported content was removed — ${removed.join("; ")}.`);

        if (!id) {
          setId(saved.id);
          window.history.replaceState(null, "", `/admin/articles/${saved.id}`);
        }
        return saved;
      } catch {
        setFormError("Couldn't save — check your connection and try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [form, id, snapshotOf, toPayload],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const publish = () =>
    startTransition(async () => {
      const clientMissing = missingForPublish(readiness);
      if (clientMissing.length) return setMissing(clientMissing);
      let articleId = id;
      let slug = form.slug;
      if (dirty || !articleId) {
        const saved = await save();
        if (!saved) return;
        articleId = saved.id;
        slug = saved.slug;
      }
      const result = await publishArticle({ id: articleId, updatePublishedAt });
      if (!result.ok) {
        if (result.missing) setMissing(result.missing);
        else setFormError(result.error);
        return;
      }
      setStatus("PUBLISHED");
      setPublishedAt(result.info.publishedAt);
      setPublishedSlug(slug);
      setUpdatePublishedAt(false);
      // Shown from the admin layout: publishing revalidates, which refreshes the
      // router, and for a new article (URL swapped from /new to /{id}) that
      // remounts this editor with the saved data from the server.
      showPublished(result.info);
    });

  const changeStatus = (action: typeof unpublishArticle, next: ArticleStatus) =>
    startTransition(async () => {
      if (!id) return;
      if (dirty && !(await save())) return;
      const result = await action({ id });
      if (result.ok) setStatus(next);
      else setFormError(result.error);
    });

  const remove = () =>
    startTransition(async () => {
      if (!id) return;
      const result = await deleteArticle({ id });
      if (!result.ok) return setFormError(result.error);
      setLastSaved(snapshot); // don't trigger the unsaved-changes prompt
      router.push("/admin/articles");
    });

  const pending = saving || busy;
  const saveLabel = status === "PUBLISHED" ? "Save changes" : "Save draft";
  const categorySlug = categories.find((c) => c.id === form.categoryId)?.slug ?? null;
  const stateEn = localeState({ title: form.titleEn, body: readiness.en.body, excerpt: form.excerptEn });
  const stateUr = localeState({ title: form.titleUr, body: readiness.ur.body, excerpt: form.excerptUr });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href="/admin/articles" className="inline-flex items-center gap-1 text-sm text-grey hover:text-ivory">
          <ArrowLeft aria-hidden className="size-4" />
          Articles
        </Link>
        <h1 className="text-2xl text-ivory">{id ? "Edit article" : "New article"}</h1>
        <StatusBadge status={status} />
        <SaveStatus saving={saving} dirty={dirty} saved={Boolean(id)} />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {aiEnabled ? (
            <Button type="button" variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setWriteOpen(true)}>
              <Sparkles aria-hidden className="text-gold" />
              AI assist
            </Button>
          ) : (
            <AiPlaceholder icon={Sparkles} label="AI assist" />
          )}
          {!aiEnabled && <AiPlaceholder icon={Languages} label="Translate to Urdu" />}
        </div>
      </div>

      {aiEnabled && (
        <WritePanel
          open={writeOpen}
          onOpenChange={setWriteOpen}
          activeLocale={tab}
          targets={{
            en: { bodyEmpty: isDocEmpty(readiness.en.body), title: form.titleEn, excerpt: form.excerptEn },
            ur: { bodyEmpty: isDocEmpty(readiness.ur.body), title: form.titleUr, excerpt: form.excerptUr },
          }}
          chosenTags={form.tags}
          onApply={({ locale, mode, doc, title, excerpt }) => {
            applyAiBody(locale, doc, mode);
            if (title) setAiField(locale, "title", title);
            if (excerpt) setAiField(locale, "excerpt", excerpt);
          }}
          onSetField={setAiField}
          onAddTag={addTag}
        />
      )}

      {formError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md border border-gold-muted bg-gold/10 px-4 py-3 text-sm text-gold">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main: language tabs */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as "en" | "ur")} className="min-w-0 gap-4">
          <TabsList className="bg-obsidian">
            <TabsTrigger value="en" className="gap-2 px-4">
              English <LocaleDot state={stateEn} />
            </TabsTrigger>
            <TabsTrigger value="ur" className="gap-2 px-4">
              <span lang="ur" className="font-urdu">اردو</span> <LocaleDot state={stateUr} />
            </TabsTrigger>
          </TabsList>

          {/* forceMount keeps both editors alive (undo history, cursor) when switching tabs. */}
          <TabsContent value="en" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <Field label="Title" error={errors.titleEn} count={[form.titleEn.length, LIMITS.title]}>
              {(fieldId) => (
                <Input
                  id={fieldId}
                  value={form.titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  maxLength={LIMITS.title}
                  className="h-12 font-serif text-xl"
                  placeholder="Headline"
                />
              )}
            </Field>
            <Field label="Excerpt" hint="One or two sentences shown on cards and share previews." count={[form.excerptEn.length, LIMITS.excerpt]}>
              {(fieldId) => (
                <Textarea id={fieldId} value={form.excerptEn} onChange={(e) => update("excerptEn", e.target.value)} maxLength={LIMITS.excerpt} rows={2} />
              )}
            </Field>
            <RichTextEditor
              locale="en"
              label="English article body"
              initialContent={initial.bodyEn}
              onChange={onBodyEn}
              onReady={onReadyEn}
              uploadsEnabled={uploadsEnabled}
            />
          </TabsContent>

          <TabsContent value="ur" forceMount lang="ur" dir="rtl" className="space-y-4 data-[state=inactive]:hidden">
            <Field label="عنوان" error={errors.titleUr} count={[form.titleUr.length, LIMITS.title]}>
              {(fieldId) => (
                <Input
                  id={fieldId}
                  value={form.titleUr}
                  onChange={(e) => update("titleUr", e.target.value)}
                  maxLength={LIMITS.title}
                  dir="rtl"
                  lang="ur"
                  className="h-14 font-urdu text-xl leading-loose"
                  placeholder="سرخی"
                />
              )}
            </Field>
            <Field label="خلاصہ" hint="ایک یا دو جملے جو کارڈز اور شیئر پری ویو میں دکھائے جائیں گے۔" count={[form.excerptUr.length, LIMITS.excerpt]}>
              {(fieldId) => (
                <Textarea
                  id={fieldId}
                  value={form.excerptUr}
                  onChange={(e) => update("excerptUr", e.target.value)}
                  maxLength={LIMITS.excerpt}
                  rows={2}
                  dir="rtl"
                  lang="ur"
                  className="font-urdu text-base leading-loose"
                />
              )}
            </Field>
            <RichTextEditor
              locale="ur"
              label="Urdu article body"
              initialContent={initial.bodyUr}
              onChange={onBodyUr}
              onReady={onReadyUr}
              uploadsEnabled={uploadsEnabled}
            />
          </TabsContent>
        </Tabs>

        {/* Side panel (stacks below on mobile) */}
        <aside className="space-y-5">
          <Panel title="Publish">
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" className="bg-transparent" onClick={() => void save()} disabled={pending}>
                {saving ? "Saving…" : saveLabel}
                <kbd className="ms-auto hidden text-[0.625rem] text-grey-dim sm:inline">Ctrl+S</kbd>
              </Button>
              {status !== "PUBLISHED" ? (
                <Button type="button" onClick={publish} disabled={pending} className="hover:bg-gold-soft">
                  {status === "ARCHIVED" ? "Publish again" : publishedAt ? "Re-publish" : "Publish"}
                </Button>
              ) : (
                <Button type="button" variant="outline" className="bg-transparent" disabled={pending} onClick={() => changeStatus(unpublishArticle, "DRAFT")}>
                  Unpublish (back to draft)
                </Button>
              )}
              {status !== "PUBLISHED" && publishedAt && (
                <label className="flex items-center gap-2 text-xs text-grey">
                  <input type="checkbox" checked={updatePublishedAt} onChange={(e) => setUpdatePublishedAt(e.target.checked)} />
                  Update the published date to now
                </label>
              )}
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-xs tracking-wide text-grey uppercase">Ready to publish?</p>
              <Checklist items={checklist} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
              {id && (
                <Link href={`/admin/articles/${id}/preview`} className="inline-flex items-center gap-1 text-gold hover:text-gold-soft">
                  <Eye aria-hidden className="size-4" /> Preview
                </Link>
              )}
              {id && status === "ARCHIVED" && (
                <button type="button" className="text-grey hover:text-ivory" disabled={pending} onClick={() => changeStatus(unpublishArticle, "DRAFT")}>
                  Move to drafts
                </button>
              )}
              {id && status !== "ARCHIVED" && (
                <button type="button" className="text-grey hover:text-ivory" disabled={pending} onClick={() => changeStatus(archiveArticle, "ARCHIVED")}>
                  Archive
                </button>
              )}
              {id && (
                <button type="button" className="text-destructive hover:underline" disabled={pending} onClick={() => setConfirmDelete(true)}>
                  Delete…
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Details">
            <Field label="Category" error={errors.categoryId}>
              {(fieldId) => (
                <select id={fieldId} className={selectClass} value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
                  {categories.length === 0 && <option value="">Create a category first</option>}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nameEn} — {category.nameUr}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <SlugField
              value={form.slug}
              onChange={(value, touched) => setForm((prev) => ({ ...prev, slug: value, slugTouched: touched }))}
              articleId={id}
              publishedSlug={publishedSlug}
              categorySlug={categorySlug}
              siteUrl={siteUrl}
              error={errors.slug}
            />
            <TagInput value={form.tags} onChange={(tags) => update("tags", tags)} options={tagOptions} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="featured">Featured on homepage</Label>
              <Switch id="featured" checked={form.isFeatured} onCheckedChange={(checked) => update("isFeatured", checked)} />
            </div>
          </Panel>

          <Panel title="Cover image">
            <CoverImageField
              url={form.coverImageUrl}
              alt={form.coverImageAlt}
              uploadsEnabled={uploadsEnabled}
              error={errors.coverImageUrl ?? errors.coverImageAlt}
              onChange={({ url, alt }) => setForm((prev) => ({ ...prev, coverImageUrl: url, coverImageAlt: alt }))}
            />
          </Panel>

          <SeoPanel form={form} update={update} errors={errors} />
        </aside>
      </div>

      <PublishBlockedDialog missing={missing} onOpenChange={() => setMissing(null)} />
      <DeleteArticleDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={form.titleEn || form.titleUr || form.slug}
        canArchive={status !== "ARCHIVED"}
        pending={pending}
        onArchive={() => {
          setConfirmDelete(false);
          changeStatus(archiveArticle, "ARCHIVED");
        }}
        onDelete={() => {
          setConfirmDelete(false);
          remove();
        }}
      />
      <AlertDialog open={Boolean(slugConfirm)} onOpenChange={(open) => !open && setSlugConfirm(null)}>
        <AlertDialogContent className="border-border bg-obsidian">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">Change the URL of a published article?</AlertDialogTitle>
            <AlertDialogDescription>
              It was published as “{publishedSlug}”. Links already shared on WhatsApp, social media or elsewhere will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">Keep the old slug</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const run = slugConfirm;
                setSlugConfirm(null);
                run?.();
              }}
            >
              Change it anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SaveStatus({ saving, dirty, saved }: { saving: boolean; dirty: boolean; saved: boolean }) {
  const text = saving ? "Saving…" : dirty ? "Unsaved changes" : saved ? "Saved" : "Not saved yet";
  return (
    <span role="status" aria-live="polite" className={cn("text-sm", dirty && !saving ? "text-gold" : "text-grey")}>
      {text}
    </span>
  );
}

function LocaleDot({ state }: { state: "empty" | "partial" | "complete" }) {
  const label = { empty: "empty", partial: "incomplete", complete: "complete" }[state];
  return (
    <span
      title={label}
      className={cn(
        "inline-block size-2 rounded-full",
        state === "complete" && "bg-emerald-400",
        state === "partial" && "bg-gold",
        state === "empty" && "border border-grey-dim",
      )}
    >
      <span className="sr-only">({label})</span>
    </span>
  );
}

function AiPlaceholder({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <Button type="button" variant="outline" size="sm" disabled className="gap-2 bg-transparent" title="Coming in Phase 3">
      <Icon aria-hidden />
      {label}
      <ComingSoon className="px-1 text-[0.625rem]" />
    </Button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border border-border bg-obsidian p-4">
      <h2 className="font-sans text-sm font-semibold tracking-wide text-grey uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  count,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  count?: [number, number];
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {count && (
          <span dir="ltr" className={cn("text-xs", count[0] > count[1] ? "text-destructive" : "text-grey-dim")}>
            {count[0]}/{count[1]}
          </span>
        )}
      </div>
      {children(id)}
      {hint && <p className="text-xs text-grey-dim">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SeoPanel({
  form,
  update,
  errors,
}: {
  form: Form;
  update: <K extends keyof Form>(key: K, value: Form[K]) => void;
  errors: FieldErrors;
}) {
  const [open, setOpen] = useState(false);
  const counter = (value: string, recommended: number) => (
    <span dir="ltr" className={cn("text-xs", value.length > recommended ? "text-gold" : "text-grey-dim")}>
      {value.length}/{recommended}
    </span>
  );
  const rows: { key: "seoTitleEn" | "seoTitleUr" | "seoDescriptionEn" | "seoDescriptionUr"; label: string; ur: boolean; title: boolean }[] = [
    { key: "seoTitleEn", label: "SEO title (English)", ur: false, title: true },
    { key: "seoDescriptionEn", label: "SEO description (English)", ur: false, title: false },
    { key: "seoTitleUr", label: "SEO title (Urdu)", ur: true, title: true },
    { key: "seoDescriptionUr", label: "SEO description (Urdu)", ur: true, title: false },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border bg-obsidian">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-sm font-semibold tracking-wide text-grey uppercase">
        Search & social (SEO)
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-4 pb-4">
        <p className="text-xs text-grey-dim">Optional. When empty, the title and excerpt are used instead.</p>
        {rows.map((row) => {
          const value = form[row.key];
          const recommended = row.title ? SEO_RECOMMENDED.title : SEO_RECOMMENDED.description;
          const max = row.title ? LIMITS.seoTitle : LIMITS.seoDescription;
          const common = {
            id: row.key,
            value,
            maxLength: max,
            dir: row.ur ? ("rtl" as const) : ("ltr" as const),
            lang: row.ur ? "ur" : "en",
            className: row.ur ? "font-urdu leading-loose" : undefined,
            placeholder: row.title ? (row.ur ? form.titleUr : form.titleEn) : row.ur ? form.excerptUr : form.excerptEn,
          };
          return (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={row.key}>{row.label}</Label>
                {counter(value, recommended)}
              </div>
              {row.title ? (
                <Input {...common} onChange={(e) => update(row.key, e.target.value)} />
              ) : (
                <Textarea {...common} rows={3} onChange={(e) => update(row.key, e.target.value)} />
              )}
              {errors[row.key] && <p className="text-xs text-destructive">{errors[row.key]}</p>}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
