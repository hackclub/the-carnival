/** Hackatime Billy review tool base URL. Override with NEXT_PUBLIC_HACKATIME_BILLY_URL if needed. */
export const HACKATIME_BILLY_BASE_URL =
  process.env.NEXT_PUBLIC_HACKATIME_BILLY_URL ?? "https://billy.3kh0.net/";

/** Joe.fraud Billy-compatible review tool base URL. */
export const HACKATIME_JOE_FRAUD_BASE_URL =
  process.env.NEXT_PUBLIC_HACKATIME_JOE_FRAUD_URL ?? "https://joe.fraud.hackclub.com/billy";

export function buildBillyUrl(hackatimeId: string, start: string, end: string): string {
  return `${HACKATIME_BILLY_BASE_URL}?u=${encodeURIComponent(hackatimeId)}&d=${start}-${end}`;
}

export function buildJoeFraudUrl(hackatimeId: string, start: string, end: string): string {
  return `${HACKATIME_JOE_FRAUD_BASE_URL}?u=${encodeURIComponent(hackatimeId)}&d=${start}-${end}`;
}
