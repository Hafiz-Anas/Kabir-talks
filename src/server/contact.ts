import "server-only";

import { count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { contactMessages, user } from "@/db/schema";
import type { ContactInput } from "@/lib/contact";
import { env } from "@/lib/env";
import { brandedEmail, sendEmail } from "@/server/email";
import { takeRateLimit } from "@/server/rate-limit";

/**
 * Contact form (Phase 7): saved to contact_messages (Admin → Messages) and
 * forwarded to every admin account by email through the email module (log
 * driver until Resend is set up). 5 messages per IP per hour.
 */

export async function submitContact(input: ContactInput, ip: string): Promise<"saved" | "ignored" | "rate_limited"> {
  if (input.website?.trim()) return "ignored";
  const limit = await takeRateLimit(`contact:ip:${ip}`, 5, 3600);
  if (!limit.allowed) return "rate_limited";

  const [message] = await db
    .insert(contactMessages)
    .values({ name: input.name, email: input.email, subject: input.subject, message: input.message, locale: input.locale })
    .returning({ id: contactMessages.id });

  const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin"));
  const inbox = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/admin/messages?id=${message.id}`;
  for (const admin of new Set(admins.map((a) => a.email))) {
    const { html, text } = brandedEmail("en", {
      preheader: input.subject,
      heading: `New message: ${input.subject}`,
      paragraphs: [`From ${input.name} <${input.email}>, on the ${input.locale === "ur" ? "Urdu" : "English"} site:`, input.message],
      button: { label: "Open in Admin → Messages", url: inbox },
      note: "Reply to this email to answer the sender directly.",
      footer: "Sent by the Kabir Talks contact form.",
    });
    await sendEmail({
      to: admin,
      subject: `[Contact] ${input.subject}`.slice(0, 200),
      html,
      text,
      kind: "contact",
      // Zod-validated address (no line breaks), so it is safe as a header.
      headers: { "Reply-To": input.email },
    });
  }
  return "saved";
}

export async function unreadMessageCount() {
  const [row] = await db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.isRead, false));
  return row.n;
}

export const MESSAGES_PAGE_SIZE = 50;

export async function listMessages(filter: "all" | "unread", page: number) {
  const where = filter === "unread" ? eq(contactMessages.isRead, false) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
      .limit(MESSAGES_PAGE_SIZE)
      .offset((page - 1) * MESSAGES_PAGE_SIZE),
    db.select({ n: count() }).from(contactMessages).where(where),
  ]);
  return { rows, total: n, pages: Math.max(1, Math.ceil(n / MESSAGES_PAGE_SIZE)) };
}

export async function getMessage(id: string) {
  const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  return row ?? null;
}
