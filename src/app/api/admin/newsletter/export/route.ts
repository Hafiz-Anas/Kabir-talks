import { z } from "zod";

import { requireAdmin } from "@/lib/auth-guards";
import { exportSubscribers } from "@/server/newsletter/admin";

/** CSV of subscribers (admin only). ?status=ACTIVE|PENDING|UNSUBSCRIBED narrows it. */

const statusSchema = z.enum(["ACTIVE", "PENDING", "UNSUBSCRIBED"]).optional().catch(undefined);

function cell(value: string | Date | null) {
  if (value === null) return "";
  const text = value instanceof Date ? value.toISOString() : value;
  // Quote everything; neutralise spreadsheet formulas (=, +, -, @ at the start).
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireAdmin("/admin/newsletter");
  const status = statusSchema.parse(new URL(request.url).searchParams.get("status") ?? undefined);
  const rows = await exportSubscribers(status);
  const header = ["email", "status", "language", "email_language", "subscribed_at", "confirmed_at", "unsubscribed_at"];
  const lines = rows.map((r) => [r.email, r.status, r.language, r.locale, r.createdAt, r.confirmedAt, r.unsubscribedAt].map(cell).join(","));
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${[header.join(","), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kabir-talks-subscribers-${status?.toLowerCase() ?? "all"}-${day}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
