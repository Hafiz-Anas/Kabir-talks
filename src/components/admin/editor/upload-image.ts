"use client";

import { isImageMime, MAX_IMAGE_BYTES } from "@/lib/uploads/file-type";
import { putToSignedUrl } from "@/lib/uploads/signed-put";
import { createImageUpload, finalizeImageUpload } from "@/server/uploads";

/**
 * Uploads one image through the admin pipeline (see src/server/uploads.ts):
 * signed URL → direct PUT to Supabase with progress → server verification.
 * Resolves with the public URL, or throws an Error with a readable message.
 */
export async function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<string> {
  // Fast client-side feedback; the server re-checks everything.
  if (!isImageMime(file.type)) throw new Error("Only JPEG, PNG, WebP and AVIF images are allowed.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");

  const start = await createImageUpload({ contentType: file.type, size: file.size });
  if (!start.ok) throw new Error(start.error);

  await putToSignedUrl(start.signedUrl, file, onProgress);
  const done = await finalizeImageUpload({ path: start.path });
  if (!done.ok) throw new Error(done.error);
  return done.url;
}
