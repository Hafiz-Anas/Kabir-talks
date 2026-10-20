"use client";

import "./globals.css";

/** Last-resort error UI when a root layout itself fails. Must render <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-3xl text-ivory">Something went wrong</h1>
        <p className="text-grey">Please try again in a moment.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-sm border border-gold-muted px-4 py-2 text-gold hover:border-gold hover:text-gold-soft"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
