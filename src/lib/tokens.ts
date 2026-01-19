export const TOKENS_PER_APPROVED_HOUR = 10;

export function tokensForApprovedHours(approvedHours: number) {
  const hours = Number.isFinite(approvedHours) ? approvedHours : 0;
  return Math.max(0, Math.floor(hours)) * TOKENS_PER_APPROVED_HOUR;
}

