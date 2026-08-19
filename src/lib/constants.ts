/**
 * External Hackatime review tool: joe.fraud (Billy-compatible).
 *
 * Billy (billy.3kh0.net) was retired — joe.fraud is the single supported tool.
 * When Telescope (its successor) ships, update the base URL here and add it to
 * REVIEW_TOOL_LINKS in src/lib/review/config.ts; every review surface and the
 * Airtable justification pick it up from these two places.
 */
export const HACKATIME_JOE_FRAUD_BASE_URL =
  process.env.NEXT_PUBLIC_HACKATIME_JOE_FRAUD_URL ?? "https://joe.fraud.hackclub.com/billy";

export function buildJoeFraudUrl(hackatimeId: string, start: string, end: string): string {
  return `${HACKATIME_JOE_FRAUD_BASE_URL}?u=${encodeURIComponent(hackatimeId)}&d=${encodeURIComponent(
    `${start}-${end}`,
  )}`;
}

export function buildHackatimeDevlogReviewUrls(input: {
  hackatimeId: string | null | undefined;
  startedAt: string;
  endedAt: string;
}) {
  const hackatimeId = input.hackatimeId?.trim();
  if (!hackatimeId) return null;

  const start = new Date(input.startedAt);
  const end = new Date(input.endedAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return null;
  }

  // joe.fraud only understands date-only ranges (YYYY-MM-DD); full ISO
  // timestamps in the `d` param break its range parsing.
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  return {
    joeFraudUrl: buildJoeFraudUrl(hackatimeId, startDate, endDate),
  };
}
