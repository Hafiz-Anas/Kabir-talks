import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Required variables fail loudly at startup. Optional variables only switch
 * their feature off (see src/lib/features.ts) — they never cause a crash.
 *
 * Plain module (no "server-only") so the seed scripts can import it via tsx.
 * Never import this file from a Client Component.
 */

// Treat empty strings ("KEY=") the same as an unset variable.
const optional = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const postgresUrl = z
  .string()
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: "must be a postgres:// or postgresql:// connection string",
  });

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: postgresUrl,
  // Optional pool size override (default: 1 in production, 5 in development).
  DATABASE_POOL_MAX: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(1).max(50).optional(),
  ),
  // Migrations only (drizzle.config.ts); the app itself never uses it.
  DIRECT_URL: z.preprocess((value) => (value === "" ? undefined : value), postgresUrl.optional()),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters (run: npx auth secret)"),
  BETTER_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Admin seed (only read by `npm run seed:admin`)
  ADMIN_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().optional(),
  ),
  ADMIN_PASSWORD: optional,

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  // Supabase Storage (used from Phase 2)
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: optional,

  // AI (optional, Phases 3 and 6). See src/lib/ai/config.ts for how these combine.
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .regex(/^[a-z0-9][a-z0-9.\-]*$/, "must be a Gemini model code, e.g. gemini-3.8-flash")
      .optional(),
  ),
  // Phase 6 "Listen": Gemini text-to-speech model and voice (defaults in src/lib/ai/config.ts).
  GEMINI_TTS_MODEL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .regex(/^[a-z0-9][a-z0-9.\-]*$/, "must be a Gemini model code, e.g. gemini-3.8-flash-tts")
      .optional(),
  ),
  GEMINI_TTS_VOICE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{1,40}$/, "must be a Gemini voice name, e.g. Kore").optional(),
  ),
  AI_PROVIDER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["gemini", "mock"]).optional(),
  ),
  // Per-admin cost guard: AI model calls allowed per minute (default 30).
  AI_RATE_LIMIT_PER_MINUTE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(1).max(10_000).optional(),
  ),

  // Phase 6 cost guards (database-backed, so they hold across serverless instances).
  // Global cap on AI model calls per day, all features together (default 1000).
  AI_DAILY_LIMIT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(0).max(1_000_000).optional(),
  ),
  // "Ask this article" questions per signed-in reader per day (default 20).
  READER_AI_ASK_PER_DAY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(0).max(10_000).optional(),
  ),

  // Email (Phase 7, src/server/email). Real sending needs BOTH the key and a sender
  // address on a domain verified in Resend; otherwise emails go to the log driver.
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .regex(/^(?:[^<>@\r\n]{1,80} <[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/, {
        message: 'must be an address, e.g. "Kabir Talks <news@kabirtalks.com>" or news@kabirtalks.com',
      })
      .optional(),
  ),
  // Local testing only: treat the log driver as a real sender, so account emails and the
  // newsletter switch on and their links can be read from /admin/emails. Never on a live server.
  EMAIL_TEST_MODE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["0", "1", "false", "true"]).optional(),
  ),
  // Newsletter queue endpoint for a cron job (POST /api/cron/newsletter). Unset → the endpoint is off;
  // `npm run newsletter:process` works either way.
  NEWSLETTER_CRON_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(32, "must be at least 32 characters (e.g. openssl rand -hex 32)").optional(),
  ),
  // Phase 7C, tests only: replaces https://www.youtube.com/feeds/videos.xml (a saved sample feed).
  // Leave unset everywhere else.
  YOUTUBE_FEED_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional(),
  ),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function parseEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `\n\n❌ Invalid environment variables:\n${issues}\n\nCopy .env.example to .env.local and fill in the required values.\n`,
    );
  }
  return parsed.data;
}

export const env = parseEnv();
