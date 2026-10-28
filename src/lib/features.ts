import { aiStatus } from "@/lib/ai/config";
import { env } from "@/lib/env";

/**
 * Feature flags derived from optional environment variables.
 *
 * Every phase that depends on an optional key must check its flag first and
 * render <ComingSoon /> (or skip the work) when it is off — never crash.
 * Server-only: pass the boolean down as a prop if a Client Component needs it.
 */
/**
 * Which email driver sends mail (src/server/email):
 *  - "resend" when RESEND_API_KEY and EMAIL_FROM are both set;
 *  - "log" otherwise: the console plus the email_outbox table (/admin/emails).
 */
export const emailDriver: "resend" | "log" = env.RESEND_API_KEY && env.EMAIL_FROM ? "resend" : "log";

/** EMAIL_TEST_MODE=1: local testing treats the log driver as connected. */
export const emailTestMode = emailDriver === "log" && (env.EMAIL_TEST_MODE === "1" || env.EMAIL_TEST_MODE === "true");

/**
 * Readers can receive email: a real provider, or test mode. Account emails and
 * the newsletter depend on it, so nobody waits for an email that only went to the log.
 */
const emailDelivery = emailDriver === "resend" || emailTestMode;

export const features = {
  /** A real Gemini key, or AI_PROVIDER=mock in development only (src/lib/ai/config.ts). */
  aiEnabled: aiStatus.mode !== "off",
  googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  /** Newsletter sign-up and sends (Phase 7). Off → no sign-up box is shown. */
  newsletterEnabled: emailDelivery,
  /**
   * Account emails (Phase 5 code, switched on in Phase 7): sign-up email
   * verification and "Forgot password?". Off → sign-up needs no verification
   * and Forgot password shows <ComingSoon />.
   */
  authEmailEnabled: emailDelivery,
  /** Image uploads to Supabase Storage (Phase 2). */
  storageEnabled: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
} as const;

export type Features = typeof features;
