"use server";

import { randomUUID } from "node:crypto";

import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { account, rateLimit, user } from "@/db/schema";
import { locales } from "@/i18n/config";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-guards";
import { DELETE_CONFIRMATION, displayNameSchema } from "@/lib/auth-rules";
import { AVATAR_OBJECT_PATH } from "@/lib/content/urls";
import { features } from "@/lib/features";
import { detectImageMime, IMAGE_TYPES, isImageMime, MAX_IMAGE_BYTES } from "@/lib/uploads/file-type";

import { articleImages, imagePrefix } from "./storage";

/**
 * Reader self-service. Every action works only on the signed-in user's own
 * row (session.user.id): there is no user id in any input, so a reader can
 * never change someone else's profile. Errors are codes; the account page
 * maps them to dictionary text.
 */

export type AccountError = "unauthorized" | "invalid" | "storage" | "photo" | "password" | "admin" | "confirm";
export type AccountResult = { ok: true } | { ok: false; error: AccountError };

const profileSchema = z.object({
  name: displayNameSchema,
  preferredLocale: z.enum(locales).nullable(),
});

export async function updateProfile(input: { name: string; preferredLocale: string | null }): Promise<AccountResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  await db
    .update(user)
    .set({ name: parsed.data.name, preferredLocale: parsed.data.preferredLocale })
    .where(eq(user.id, session.user.id));
  return { ok: true };
}

// ── Profile photo: same pipeline and checks as article images (src/server/uploads.ts) ──

function avatarPathFromUrl(url: string | null | undefined): string | null {
  const prefix = imagePrefix();
  if (!url || !prefix || !url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return AVATAR_OBJECT_PATH.test(path) ? path : null;
}

async function removeStoredAvatar(url: string | null | undefined) {
  const path = avatarPathFromUrl(url);
  if (!path || !features.storageEnabled) return;
  const { error } = await articleImages().remove([path]);
  if (error) console.error("avatar remove failed", error.message);
}

export type AvatarUploadStart = { ok: true; signedUrl: string; path: string } | { ok: false; error: AccountError };

export async function createAvatarUpload(input: { contentType: string; size: number }): Promise<AvatarUploadStart> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!features.storageEnabled) return { ok: false, error: "storage" };

  const parsed = z.object({ contentType: z.string().max(100), size: z.number().int().positive() }).safeParse(input);
  if (!parsed.success || !isImageMime(parsed.data.contentType) || parsed.data.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "photo" };
  }

  const path = `avatars/${session.user.id}/${randomUUID()}.${IMAGE_TYPES[parsed.data.contentType]}`;
  const { data, error } = await articleImages().createSignedUploadUrl(path);
  if (error || !data) {
    console.error("avatar createSignedUploadUrl failed", error?.message);
    return { ok: false, error: "storage" };
  }
  return { ok: true, signedUrl: data.signedUrl, path };
}

export async function finalizeAvatarUpload(input: { path: string }): Promise<AccountResult & { url?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!features.storageEnabled) return { ok: false, error: "storage" };

  // Only the caller's own folder: a reader can't claim another reader's upload.
  const path = typeof input?.path === "string" ? input.path : "";
  if (!AVATAR_OBJECT_PATH.test(path) || !path.startsWith(`avatars/${session.user.id}/`)) return { ok: false, error: "photo" };

  const bucket = articleImages();
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) return { ok: false, error: "photo" };

  const head = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const detected = detectImageMime(head);
  if (blob.size > MAX_IMAGE_BYTES || !detected || !path.endsWith(`.${IMAGE_TYPES[detected]}`)) {
    await bucket.remove([path]);
    return { ok: false, error: "photo" };
  }

  const url = `${imagePrefix()}${path}`;
  const [previous] = await db.select({ image: user.image }).from(user).where(eq(user.id, session.user.id));
  await db.update(user).set({ image: url }).where(eq(user.id, session.user.id));
  await removeStoredAvatar(previous?.image);
  return { ok: true, url };
}

export async function removeAvatar(): Promise<AccountResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const [current] = await db.select({ image: user.image }).from(user).where(eq(user.id, session.user.id));
  await db.update(user).set({ image: null }).where(eq(user.id, session.user.id));
  await removeStoredAvatar(current?.image);
  return { ok: true };
}

// ── Delete account ──

const deleteSchema = z.object({
  confirm: z.literal(DELETE_CONFIRMATION),
  password: z.string().max(200).optional(),
});

/**
 * Deletes the signed-in reader. The database does the rest: sessions,
 * accounts and bookmarks cascade; comments keep their text with user_id set
 * to NULL ("Deleted user"). Email/password accounts must re-enter the
 * password. The admin can't delete themselves here (their articles depend
 * on the account).
 */
export async function deleteAccount(input: { confirm: string; password?: string }): Promise<AccountResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (session.user.role === "admin") return { ok: false, error: "admin" };
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "confirm" };

  const userId = session.user.id;
  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (credential?.password) {
    const ok = parsed.data.password
      ? await verifyPassword({ hash: credential.password, password: parsed.data.password })
      : false;
    if (!ok) return { ok: false, error: "password" };
  }

  const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
  // Clears the session cookie (nextCookies plugin) before the session rows disappear.
  await auth.api.signOut({ headers: await headers() });
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(rateLimit).where(eq(rateLimit.key, `comment:${userId}`));
  await removeStoredAvatar(row?.image);
  return { ok: true };
}
