import type { LedgerAdjustmentKind } from "@/lib/admin-safety";

// Reference types an admin can pick for a manual ledger adjustment. They are
// namespaced `admin_*` on purpose: `project_grant`, `bounty_bonus` and
// `shop_order` are written by the system and read back by grant/wallet logic
// (e.g. src/lib/wallet.ts), so manual rows must never reuse them.
export const ADMIN_LEDGER_REFERENCE_TYPES = [
  {
    id: "admin_adjustment",
    label: "General adjustment",
    description: "Anything that doesn't fit the other types.",
    kinds: ["issue", "deduct"],
  },
  {
    id: "admin_grant_correction",
    label: "Grant correction",
    description: "Fix tokens from a project grant that were issued wrong.",
    kinds: ["issue", "deduct"],
  },
  {
    id: "admin_refund",
    label: "Refund",
    description: "Return tokens for a cancelled or failed shop order.",
    kinds: ["issue"],
  },
  {
    id: "admin_prize",
    label: "Prize / bonus",
    description: "Event prizes, bounty payouts or other bonuses.",
    kinds: ["issue"],
  },
  {
    id: "admin_clawback",
    label: "Fraud clawback",
    description: "Take back tokens earned through fraud or rule breaks.",
    kinds: ["deduct"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  kinds: readonly LedgerAdjustmentKind[];
}>;

export type AdminLedgerReferenceType = (typeof ADMIN_LEDGER_REFERENCE_TYPES)[number]["id"];

export const DEFAULT_ADMIN_LEDGER_REFERENCE_TYPE: AdminLedgerReferenceType = "admin_adjustment";

// Labels for every reference type that can appear in the ledger, including
// the system-written ones, for display and audit filters.
export const LEDGER_REFERENCE_TYPE_LABELS: Record<string, string> = {
  project_grant: "Project grant",
  bounty_bonus: "Bounty bonus",
  shop_order: "Shop order",
  ...Object.fromEntries(ADMIN_LEDGER_REFERENCE_TYPES.map((t) => [t.id, t.label])),
};

export function isAdminLedgerReferenceType(value: unknown): value is AdminLedgerReferenceType {
  return ADMIN_LEDGER_REFERENCE_TYPES.some((t) => t.id === value);
}

export function adminReferenceTypesForKind(kind: LedgerAdjustmentKind) {
  return ADMIN_LEDGER_REFERENCE_TYPES.filter((t) =>
    (t.kinds as readonly LedgerAdjustmentKind[]).includes(kind),
  );
}
