"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth-guards";
import { IMAGE_OBJECT_PATH } from "@/lib/content/urls";
import { features } from "@/lib/features";
import { detectImageMime, IMAGE_TYPES, isImageMime, MAX_IMAGE_BYTES } from "@/lib/uploads/file-type";

import { articleImages, imagePrefix } from "./storage";

/**
 * Image upload pipeline (cover + inline images), in two admin-only steps:
 *
 *  1. createImageUpload: validates the declared type/size and returns a
 *     short-lived signed upload URL for a fresh, unguessable path
 *     (articles/{yyyy}/{mm}/{uuid}.{ext}). The browser PUTs the file straight
 *     to Supabase, which allows real progress events and avoids Vercel's
 *     4.5 MB request-body limit.
 *  2. finalizeImageUpload: downloads what was stored, checks the real size
 *     and the file's magic bytes, and deletes it if it isn't an allowed
 *     image. Only then is the public URL returned to the editor.
 *
 * The service-role key only ever lives in src/server/storage.ts.
 */

export type CreateUploadResult =
  | { ok: true; signedUrl: string; path: string }
  | { ok: false; error: string };

export type FinalizeUploadResult = { ok: true; url: string; path: string } | { ok: false; error: string };

const NOT_CONFIGURED = "Image uploads aren't configured yet (see README → Supabase Storage).";

export async function createImageUpload(input: { contentType: string; size: number }): Promise<CreateUploadResult> {
  await requireAdmin();
  if (!features.storageEnabled) return { ok: false, error: NOT_CONFIGURED };

  const parsed = z
    .object({ contentType: z.string().max(100), size: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };
  const { contentType, size } = parsed.data;

  if (!isImageMime(contentType)) return { ok: false, error: "Only JPEG, PNG, WebP and AVIF images are allowed." };
  if (size > MAX_IMAGE_BYTES) return { ok: false, error: "Images must be 5 MB or smaller." };

  const now = new Date();
  const path = `articles/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;

  const { data, error } = await articleImages().createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return { ok: false, error: "Couldn't start the upload. Check that the article-images bucket exists." };
  }
  return { ok: true, signedUrl: data.signedUrl, path };
}

export async function finalizeImageUpload(input: { path: string }): Promise<FinalizeUploadResult> {
  await requireAdmin();
  if (!features.storageEnabled) return { ok: false, error: NOT_CONFIGURED };

  const path = typeof input?.path === "string" ? input.path : "";
  if (!IMAGE_OBJECT_PATH.test(path)) return { ok: false, error: "Invalid upload path." };

  const bucket = articleImages();
  const { data: blob, error } = await bucket.download(path);
  if (error || !blob) return { ok: false, error: "The upload didn't arrive. Please try again." };

  const reject = async (message: string) => {
    await bucket.remove([path]);
    return { ok: false as const, error: message };
  };

  if (blob.size > MAX_IMAGE_BYTES) return reject("Images must be 5 MB or smaller.");
  const head = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const detected = detectImageMime(head);
  if (!detected) return reject("That file isn't a real JPEG, PNG, WebP or AVIF image.");
  if (!path.endsWith(`.${IMAGE_TYPES[detected]}`)) {
    return reject("The file's contents don't match its type. Please re-export the image and try again.");
  }

  return { ok: true, url: `${imagePrefix()}${path}`, path };
}
