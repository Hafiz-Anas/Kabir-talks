import { Search } from "lucide-react";
import Form from "next/form";

import type { Dictionary, Locale } from "@/i18n";

/** Max characters accepted in the box; the server also normalizes and caps (normalizeSearchQuery). */
export const SEARCH_INPUT_MAX = 100;

/**
 * GET form to /{locale}/search?q=… (next/form navigates client-side, and it
 * still works without JavaScript). Used in the header panel, the mobile menu
 * and on the search page.
 */
export function SearchForm({
  locale,
  labels,
  defaultValue,
  autoFocus,
}: {
  locale: Locale;
  labels: Pick<Dictionary["search"], "label" | "placeholder" | "submit">;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <Form action={`/${locale}/search`} role="search" className="flex gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{labels.label}</span>
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-grey-dim" />
        <input
          type="search"
          name="q"
          required
          minLength={2}
          maxLength={SEARCH_INPUT_MAX}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder={labels.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 w-full rounded-sm border border-input bg-obsidian ps-9 pe-3 text-base text-ivory placeholder:text-grey focus-visible:border-gold-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </label>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-sm bg-gold px-4 text-sm font-medium text-black transition-colors hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
      >
        {labels.submit}
      </button>
    </Form>
  );
}
