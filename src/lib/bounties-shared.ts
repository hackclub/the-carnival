/**
 * Pure bounty helpers shared by server pages, client components and Slack
 * copy. No DB imports (see bounties.ts for the DB-aware half).
 */
import { FIXED_RATE_TOKENS, FIXED_RATE_USD, TOKENS_PER_HOUR } from "@/lib/wallet-converter";

// 1 approved hour = TOKENS_PER_HOUR tokens = GRANT_USD_PER_HOUR dollars.
export const GRANT_USD_PER_HOUR = (FIXED_RATE_USD / FIXED_RATE_TOKENS) * TOKENS_PER_HOUR;

/** People can claim an active bounty and link a project to it. */
export function isActiveBounty(bounty: { status: string; completed: boolean }) {
  return bounty.status === "approved" && !bounty.completed;
}

/** The prize expressed in hours at the standard grant rate. */
export function getBountyEquivalentHours(prizeUsd: number) {
  const normalizedPrizeUsd = Number.isFinite(prizeUsd) ? Math.max(0, prizeUsd) : 0;
  return normalizedPrizeUsd / GRANT_USD_PER_HOUR;
}

/** Hours someone has to put in to earn the bounty: half the equivalent, plus one. */
export function getBountyMinimumHours(prizeUsd: number) {
  return getBountyEquivalentHours(prizeUsd) / 2 + 1;
}

export function formatBountyHours(hours: number) {
  const normalizedHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const roundedHours = Number.isInteger(normalizedHours)
    ? normalizedHours.toString()
    : normalizedHours.toFixed(2).replace(/\.?0+$/, "");
  return `${roundedHours} hour${normalizedHours === 1 ? "" : "s"}`;
}
