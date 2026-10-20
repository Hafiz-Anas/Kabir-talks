import type { z } from "zod";

import { AiError } from "./errors";

/** Parses and validates structured model output. Pure (testable without a server). */
export function parseJsonOutput<T>(text: string, schema: z.ZodType<T>): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new AiError("invalid_output");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AiError("invalid_output");
  return parsed.data;
}
