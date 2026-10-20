import "./load-env";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { db, pgClient } from "./index";
import { account, user } from "./schema";

/**
 * Creates (or promotes) the single admin from ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Rows are written exactly the way Better Auth's email/password sign-up writes
 * them (user + "credential" account, password hashed with Better Auth's own
 * hasher), so the admin can sign in at /login normally.
 *
 *   npm run seed:admin                     create admin, or promote existing user
 *   npm run seed:admin -- --reset-password also overwrite the password from env
 */
async function main() {
  const email = env.ADMIN_EMAIL?.toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const resetPassword = process.argv.includes("--reset-password");

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (!existing) {
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: "Admin",
        email,
        emailVerified: true,
        role: "admin",
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });
    });

    console.log(`✔ Admin created: ${email}`);
    return;
  }

  await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
  console.log(`✔ Existing user ${email} has role "admin"`);

  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, existing.id), eq(account.providerId, "credential")),
  });

  if (!credential) {
    await db.insert(account).values({
      id: randomUUID(),
      accountId: existing.id,
      providerId: "credential",
      userId: existing.id,
      password: await hashPassword(password),
    });
    console.log("✔ Email/password login added for this user");
  } else if (resetPassword) {
    await db
      .update(account)
      .set({ password: await hashPassword(password) })
      .where(eq(account.id, credential.id));
    console.log("✔ Password reset from ADMIN_PASSWORD");
  } else {
    console.log("ℹ Password left unchanged (pass --reset-password to overwrite it from env)");
  }
}

main()
  .catch((error) => {
    console.error("✖ Admin seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
