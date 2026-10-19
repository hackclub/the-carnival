import { createHmac, timingSafeEqual } from "node:crypto";

/** Robert rejects nothing older; we refuse anything further than this from our clock. */
export const ROBERT_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verify Robert's `X-Robert-Signature`: `sha256=` + hex HMAC-SHA256 of
 * `"<X-Robert-Timestamp>.<raw body>"` keyed by the webhook secret. Must run
 * on the raw bytes, before any JSON parsing.
 */
export function verifyRobertWebhookSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
}): boolean {
  const { secret, timestamp, signature, rawBody } = input;
  if (!secret || !timestamp || !signature) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const now = input.nowSeconds ?? Date.now() / 1000;
  if (Math.abs(now - Number(timestamp)) > ROBERT_WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected =
    "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
