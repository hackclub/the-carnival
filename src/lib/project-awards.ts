import type { ProjectStatus } from "@/db/schema";
import { tokensForApprovedHours } from "@/lib/tokens";

export function formatApprovedHoursLabel(approvedHours: number) {
  const safe = Number.isFinite(approvedHours) ? Math.max(0, approvedHours) : 0;
  return `${Number.isInteger(safe) ? safe.toFixed(0) : safe.toFixed(1)}h`;
}

export function buildApprovedProjectAwardSummary(input: {
  status: ProjectStatus;
  approvedHours: number | null | undefined;
}) {
  if (input.status !== "shipped" && input.status !== "granted") return null;
  if (input.approvedHours === null || input.approvedHours === undefined) return null;

  return {
    approvedHoursLabel: formatApprovedHoursLabel(input.approvedHours),
    tokensLabel: `${tokensForApprovedHours(input.approvedHours)} tokens`,
  };
}
