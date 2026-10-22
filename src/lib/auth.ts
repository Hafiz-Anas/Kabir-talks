import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { displayNameSchema, isPasswordValid, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";
import { env } from "@/lib/env";
import { features } from "@/lib/features";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/email";

export const USER_ROLES = ["admin", "reader"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Per-IP limits for the auth endpoints, stored in the rate_limit table so
 * they hold across serverless instances. The IP comes from x-forwarded-for
 * (set by Vercel). Rules are matched in order; everything else (session
 * reads, sign-out, OAuth callbacks) is not limited, so reading the session on
 * every page view never writes to the database.
 */
export const AUTH_RATE_LIMITS = {
  "/sign-in/*": { window: 5 * 60, max: 10 },
  "/sign-up/*": { window: 60 * 60, max: 10 },
  "/change-password": { window: 10 * 60, max: 10 },
  "/request-password-reset": { window: 60 * 60, max: 5 },
  "/reset-password": { window: 10 * 60, max: 10 },
  "/send-verification-email": { window: 60 * 60, max: 5 },
  "/**": false,
} as const;

function weakPassword() {
  return new APIError("BAD_REQUEST", {
    message: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters and include a letter and a number.`,
    code: "WEAK_PASSWORD",
  });
}

export const auth = betterAuth({
  appName: "Kabir Talks",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_SITE_URL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    // Both switch on together in Phase 7 (features.authEmailEnabled).
    requireEmailVerification: features.authEmailEnabled,
    revokeSessionsOnPasswordReset: true,
    ...(features.authEmailEnabled
      ? { sendResetPassword: async ({ user, url }) => sendPasswordResetEmail(user, url) }
      : {}),
  },

  ...(features.authEmailEnabled
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user, url }) => sendVerificationEmail(user, url),
        },
      }
    : {}),

  socialProviders: features.googleAuthEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  user: {
    additionalFields: {
      role: {
        type: [...USER_ROLES],
        required: false,
        defaultValue: "reader",
        // Never accept a role from sign-up input: admins are created by the seed script only.
        input: false,
      },
      // Phase 5: shown in the session so sign-in can land in the reader's language.
      // Read-only here; changed only by updateProfile (src/server/account-actions.ts).
      preferredLocale: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  rateLimit: {
    // Better Auth only limits in production by default; on everywhere so it can be tested locally.
    enabled: true,
    storage: "database",
    customRules: AUTH_RATE_LIMITS,
  },

  // Profile changes go through our own validated server actions (src/server/account-actions.ts),
  // not Better Auth's generic update endpoint (which would accept any name or image URL).
  disabledPaths: ["/update-user"],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      if (ctx.path === "/sign-up/email") {
        if (!isPasswordValid(body.password)) throw weakPassword();
        const name = displayNameSchema.safeParse(body.name);
        if (!name.success) throw new APIError("BAD_REQUEST", { message: "Please enter your name.", code: "INVALID_NAME" });
        return { context: { ...ctx, body: { ...body, name: name.data } } };
      }
      if ((ctx.path === "/change-password" || ctx.path === "/reset-password") && !isPasswordValid(body.newPassword)) {
        throw weakPassword();
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // Belt and braces on top of `input: false`: every account created through
        // Better Auth (email or Google) is a reader. Only `npm run seed:admin`,
        // which writes to the database directly, can create an admin.
        before: async (user, ctx) => ({
          data: {
            ...user,
            role: "reader",
            // Email sign-ups can't set a profile picture URL (Google's own photo is kept).
            image: ctx?.path === "/sign-up/email" ? null : user.image,
          },
        }),
      },
    },
  },

  // Must be the last plugin: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
