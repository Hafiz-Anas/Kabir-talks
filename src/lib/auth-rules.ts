import { z } from "zod";

/**
 * Reader account rules shared by the sign-up form (live checklist) and the
 * server (Better Auth hooks in src/lib/auth.ts, account actions). Pure: safe
 * in Client Components.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;

/** Sent by the delete-account dialog once the reader has typed the (localized) confirmation word. */
export const DELETE_CONFIRMATION = "DELETE";

export type PasswordRule = "length" | "letter" | "number";

/** Each rule and whether `password` meets it, in display order. */
export function passwordChecks(password: string): { rule: PasswordRule; ok: boolean }[] {
  return [
    { rule: "length", ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { rule: "letter", ok: /\p{L}/u.test(password) },
    { rule: "number", ok: /\p{N}/u.test(password) },
  ];
}

export function isPasswordValid(password: unknown): password is string {
  return typeof password === "string" && passwordChecks(password).every((check) => check.ok);
}

/** Display names: trimmed, 1–60 characters, no control characters, any script (Urdu, English, mixed). */
export const displayNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(NAME_MAX)
      .refine((value) => !/[\p{Cc}\p{Cf}<>]/u.test(value), "Invalid characters"),
  );

/**
 * Post sign-in destination: same-site paths only. Rejects absolute and
 * protocol-relative URLs (`https://evil.com`, `//evil.com`, `/\evil.com`),
 * control characters, API routes and the auth pages themselves (no loops).
 */
export function safeReturnPath(value: string | null | undefined, fallback: string) {
  if (!value || value.length > 1000 || !value.startsWith("/") || /[\\\u0000-\u001F\u007F]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, "http://same.site");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://same.site") return fallback;
  const path = url.pathname;
  if (path.startsWith("/api/") || /^\/(en|ur)\/(login|signup|forgot-password|reset-password)(\/|$)/.test(path)) return fallback;
  return `${path}${url.search}${url.hash}`;
}
