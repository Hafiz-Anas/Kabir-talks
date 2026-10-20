"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/articles/slug";
import { type CategoryInput, deleteCategory, moveCategory, saveCategory } from "@/server/category-actions";
import type { AdminCategoryRow } from "@/server/categories";

export function CategoryManager({ categories }: { categories: AdminCategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AdminCategoryRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const move = (id: string, direction: "up" | "down") =>
    startTransition(async () => {
      const result = await moveCategory({ id, direction });
      if (!result.ok) setError(result.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} className="hover:bg-gold-soft">
          <Plus aria-hidden /> New category
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-grey">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-obsidian">
          {categories.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${category.nameEn} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(category.id, "up")}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${category.nameEn} down`}
                  disabled={pending || index === categories.length - 1}
                  onClick={() => move(category.id, "down")}
                >
                  <ArrowDown />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-ivory">
                  {category.nameEn}{" "}
                  <span lang="ur" dir="rtl" className="font-urdu text-grey">
                    {category.nameUr}
                  </span>
                </p>
                <p className="text-xs text-grey-dim" dir="ltr">
                  /{category.slug} · order {category.sortOrder}
                </p>
              </div>
              <span className="text-sm text-grey">
                {category.articleCount} article{category.articleCount === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.nameEn}`} onClick={() => setEditing(category)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.nameEn}`} onClick={() => setDeleting(category)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormDialog
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
      <DeleteCategoryDialog
        category={deleting}
        others={categories.filter((c) => c.id !== deleting?.id)}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function CategoryFormDialog({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategoryRow | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-obsidian">
        {category && (
          <CategoryForm key={category === "new" ? "new" : category.id} category={category} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted fresh for each open, so state starts from the category being edited. */
function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategoryRow | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const isNew = category === "new";
  const [values, setValues] = useState<CategoryInput>(() =>
    category === "new"
      ? { nameEn: "", nameUr: "", slug: "", descriptionEn: "", descriptionUr: "" }
      : {
          id: category.id,
          nameEn: category.nameEn,
          nameUr: category.nameUr,
          slug: category.slug,
          descriptionEn: category.descriptionEn ?? "",
          descriptionUr: category.descriptionUr ?? "",
          sortOrder: category.sortOrder,
        },
  );
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryInput, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof CategoryInput, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const slugChanged = category !== "new" && values.slug !== category.slug && category.articleCount > 0;

  return (
    <>
        <DialogHeader>
          <DialogTitle className="text-ivory">{isNew ? "New category" : "Edit category"}</DialogTitle>
          <DialogDescription>Names appear in the site navigation for each language.</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveCategory(values);
              if (result.ok) return onSaved();
              setErrors(result.fieldErrors ?? {});
              setFormError(result.error);
            });
          }}
        >
          <FormRow label="Name (English)" error={errors.nameEn} htmlFor={`${formId}-en`}>
            <Input
              id={`${formId}-en`}
              value={values.nameEn}
              maxLength={80}
              required
              onChange={(e) => {
                set("nameEn", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value, 80));
              }}
            />
          </FormRow>
          <FormRow label="Name (Urdu)" error={errors.nameUr} htmlFor={`${formId}-ur`}>
            <Input
              id={`${formId}-ur`}
              value={values.nameUr}
              maxLength={80}
              required
              dir="rtl"
              lang="ur"
              className="font-urdu leading-loose"
              onChange={(e) => set("nameUr", e.target.value)}
            />
          </FormRow>
          <FormRow label="Slug" error={errors.slug} htmlFor={`${formId}-slug`}>
            <Input
              id={`${formId}-slug`}
              dir="ltr"
              value={values.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
            />
            {slugChanged && (
              <p className="text-xs text-gold">
                Changing the slug changes the URL of all {category.articleCount} articles in this category.
              </p>
            )}
          </FormRow>
          <FormRow label="Description (English, optional)" error={errors.descriptionEn} htmlFor={`${formId}-den`}>
            <Textarea id={`${formId}-den`} rows={2} maxLength={500} value={values.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value)} />
          </FormRow>
          <FormRow label="Description (Urdu, optional)" error={errors.descriptionUr} htmlFor={`${formId}-dur`}>
            <Textarea
              id={`${formId}-dur`}
              rows={2}
              maxLength={500}
              dir="rtl"
              lang="ur"
              className="font-urdu leading-loose"
              value={values.descriptionUr ?? ""}
              onChange={(e) => set("descriptionUr", e.target.value)}
            />
          </FormRow>
          {!isNew && (
            <FormRow label="Sort order" error={errors.sortOrder} htmlFor={`${formId}-order`}>
              <Input
                id={`${formId}-order`}
                type="number"
                min={0}
                max={10000}
                value={String(values.sortOrder ?? 0)}
                onChange={(e) => setValues((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
              />
            </FormRow>
          )}
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

function FormRow({ label, error, htmlFor, children }: { label: string; error?: string; htmlFor: string; children: React.ReactNode }) {
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

function DeleteCategoryDialog({
  category,
  others,
  onClose,
  onDeleted,
}: {
  category: AdminCategoryRow | null;
  others: AdminCategoryRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  return (
    <Dialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-obsidian">
        {category && <DeleteCategoryForm key={category.id} category={category} others={others} onClose={onClose} onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryForm({
  category,
  others,
  onClose,
  onDeleted,
}: {
  category: AdminCategoryRow;
  others: AdminCategoryRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const selectId = useId();
  const [target, setTarget] = useState(() => others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = category.articleCount;

  return (
          <>
            <DialogHeader>
              <DialogTitle className="text-ivory">Delete “{category.nameEn}”?</DialogTitle>
              <DialogDescription>
                {count === 0
                  ? "This category has no articles. Deleting it can’t be undone."
                  : `This category has ${count} article${count === 1 ? "" : "s"}. They must be moved to another category before it can be deleted.`}
              </DialogDescription>
            </DialogHeader>
            {count > 0 &&
              (others.length === 0 ? (
                <p className="text-sm text-destructive">Create another category first, so these articles have somewhere to go.</p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={selectId}>Move the articles to</Label>
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
                  <p className="text-xs text-gold">Published articles will get new URLs; links to the old ones will stop working.</p>
                </div>
              ))}
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
                    const result = await deleteCategory({ id: category.id, reassignTo: count > 0 ? target : undefined });
                    if (result.ok) return onDeleted();
                    setError(result.error);
                  })
                }
              >
                {count > 0 ? `Move ${count} and delete` : "Delete category"}
              </Button>
            </DialogFooter>
          </>
  );
}
