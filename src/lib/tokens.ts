export const TOKENS_PER_APPROVED_HOUR = 10;

export function tokensForApprovedHours(approvedHours: number) {
  const hours = Number.isFinite(approvedHours) ? approvedHours : 0;
  // Approved hours come in 0.1h steps, so this is a whole number; round only
  // to absorb float noise (1.1 * 10 = 11.000000000000002).
  return Math.max(0, Math.round(hours * TOKENS_PER_APPROVED_HOUR));
}

