"use client";

import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { SearchForm } from "@/components/search-form";
import type { Dictionary, Locale } from "@/i18n";

/** Search icon in the header; opens a full-width search bar under the masthead. */
export function HeaderSearch({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Pick<Dictionary["nav"], "openSearch" | "closeSearch"> & Dictionary["search"];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close once the search navigates to the results page.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.closeSearch : labels.openSearch}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 shrink-0 place-items-center rounded-sm text-grey transition-colors hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {open ? <X aria-hidden className="size-5" /> : <Search aria-hidden className="size-5" />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-black/95 backdrop-blur"
      >
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          {open && <SearchForm locale={locale} labels={labels} autoFocus />}
        </div>
      </div>
    </>
  );
}
