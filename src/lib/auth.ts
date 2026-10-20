import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { features } from "@/lib/features";

export const USER_ROLES = ["admin", "reader"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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
    minPasswordLength: 8,
  },

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
    },
  },

  // Must be the last plugin: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
