"use client";

import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { LIMITS } from "@/lib/articles/rules";
import { slugify } from "@/lib/articles/slug";

export type TagValue = { id?: string; nameEn: string; nameUr?: string | null };

/** Pick existing tags or type a new one and press Enter/comma to create it on save. */
export function TagInput({
  value,
  onChange,
  options,
}: {
  value: TagValue[];
  onChange: (next: TagValue[]) => void;
  options: { id: string; slug: string; nameEn: string; nameUr: string | null }[];
}) {
  const id = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chosenSlugs = useMemo(() => new Set(value.map((tag) => slugify(tag.nameEn, 60))), [value]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((tag) => !chosenSlugs.has(tag.slug))
      .filter((tag) => tag.nameEn.toLowerCase().includes(q) || tag.nameUr?.includes(query.trim()))
      .slice(0, 6);
  }, [options, query, chosenSlugs]);

  function add(tag: TagValue) {
    setError(null);
    if (value.length >= LIMITS.tags) return setError(`Up to ${LIMITS.tags} tags.`);
    const slug = slugify(tag.nameEn, 60);
    if (!slug) return setError("Tags need an English (Latin-letter) name.");
    if (chosenSlugs.has(slug)) return setQuery("");
    const existing = options.find((option) => option.slug === slug);
    onChange([...value, existing ? { id: existing.id, nameEn: existing.nameEn, nameUr: existing.nameUr } : tag]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Tags
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag.id ?? tag.nameEn}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-obsidian-raised py-0.5 ps-2 pe-1 text-xs"
            >
              {tag.nameEn}
              {!tag.id && <span className="text-grey-dim">(new)</span>}
              <button
                type="button"
                aria-label={`Remove tag ${tag.nameEn}`}
                onClick={() => onChange(value.filter((other) => other !== tag))}
                className="rounded-sm p-0.5 text-grey hover:text-ivory"
              >
                <X aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          id={id}
          value={query}
          maxLength={LIMITS.tagName}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && query.trim()) {
              e.preventDefault();
              add({ nameEn: query.trim() });
            }
          }}
          placeholder="Type a tag and press Enter"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-grey-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {suggestions.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-obsidian shadow-lg">
            {suggestions.map((tag) => (
              <li key={tag.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => add({ id: tag.id, nameEn: tag.nameEn, nameUr: tag.nameUr })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-obsidian-raised"
                >
                  {tag.nameEn}
                  {tag.nameUr && (
                    <span lang="ur" dir="rtl" className="font-urdu text-xs text-grey">
                      {tag.nameUr}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
