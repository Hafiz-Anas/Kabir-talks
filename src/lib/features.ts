import { aiStatus } from "@/lib/ai/config";
import { env } from "@/lib/env";

/**
 * Feature flags derived from optional environment variables.
 *
 * Every phase that depends on an optional key must check its flag first and
 * render <ComingSoon /> (or skip the work) when it is off — never crash.
 * Server-only: pass the boolean down as a prop if a Client Component needs it.
 */
export const features = {
  /** A real Gemini key, or AI_PROVIDER=mock in development only (src/lib/ai/config.ts). */
  aiEnabled: aiStatus.mode !== "off",
  googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  newsletterEnabled: Boolean(env.RESEND_API_KEY),
  /** Image uploads to Supabase Storage (Phase 2). */
  storageEnabled: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
} as const;

export type Features = typeof features;
