import "server-only";

import { createHash } from "node:crypto";

import { articleSourceText } from "@/lib/ai/reader";
import type { ArticleDoc } from "@/lib/content/document";

/**
 * SHA-256 of the text every reader AI feature works from (title + plain
 * body). A cached summary or audio file is current while this matches.
 */
export const sourceHash = (text: string) => createHash("sha256").update(text).digest("hex");

export const articleSourceHash = (title: string, body: ArticleDoc | null | undefined) =>
  sourceHash(articleSourceText(title, body));
