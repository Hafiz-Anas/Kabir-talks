import "server-only";

import { StorageClient } from "@supabase/storage-js";

import { ARTICLE_AUDIO_BUCKET, ARTICLE_IMAGE_BUCKET, storagePublicPrefix } from "@/lib/content/urls";
import { env } from "@/lib/env";
import { features } from "@/lib/features";

/**
 * Supabase Storage client authenticated with the SERVICE ROLE key.
 * Server-only: this module must never be imported by a Client Component
 * (the "server-only" import makes that a build error).
 */
let client: StorageClient | null = null;

function storage() {
  if (!features.storageEnabled) {
    throw new Error("Storage is not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  }
  client ??= new StorageClient(`${new URL(env.NEXT_PUBLIC_SUPABASE_URL!).origin}/storage/v1`, {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
  });
  return client;
}

export function articleImages() {
  return storage().from(ARTICLE_IMAGE_BUCKET);
}

/** Phase 6: generated "Listen" audio (written only by the server, read publicly). */
export function articleAudio() {
  return storage().from(ARTICLE_AUDIO_BUCKET);
}

/** Public URL prefix images must start with (used by the sanitizer and renderer). */
export function imagePrefix(): string | null {
  return storagePublicPrefix(env.NEXT_PUBLIC_SUPABASE_URL);
}
