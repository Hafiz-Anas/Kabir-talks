import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Newsletter link tokens. The token in an email link is never stored: the
 * database keeps only HMAC-SHA256(BETTER_AUTH_SECRET, purpose + token), so a
 * leaked table can't be used to confirm or unsubscribe anyone.
 *
 *  - Confirmation: random 256-bit token, expires CONFIRM_TTL_HOURS after
 *    it is sent; a new sign-up attempt replaces it.
 *  - Unsubscribe: derived from the subscriber id with the same secret, so
 *    every email can carry the link without storing it. Rotating
 *    BETTER_AUTH_SECRET invalidates old unsubscribe links (the page then
 *    asks the reader to use the link in a newer email or contact us).
 */

export const CONFIRM_TTL_HOURS = 48;

type Purpose = "confirm" | "unsubscribe";

export function hashToken(purpose: Purpose, token: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`newsletter:${purpose}:${token}`).digest("base64url");
}

export function newConfirmToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken("confirm", token), expiresAt: new Date(Date.now() + CONFIRM_TTL_HOURS * 3600_000) };
}

export function unsubscribeToken(subscriberId: string) {
  const token = createHmac("sha256", env.BETTER_AUTH_SECRET).update(`newsletter:unsubscribe-id:${subscriberId}`).digest("base64url");
  return { token, hash: hashToken("unsubscribe", token) };
}

/** Link tokens are base64url, 43 characters. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
