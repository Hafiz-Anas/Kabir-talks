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

  // AI (optional, Phases 3 and 6)
  GEMINI_API_KEY: optional,

  // Newsletter email provider (optional, Phase 7)
  RESEND_API_KEY: optional,
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
