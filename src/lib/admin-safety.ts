export const LEDGER_ADJUSTMENT_CONFIRMATION = "CONFIRM_LEDGER_ADJUSTMENT";

export type LedgerAdjustmentKind = "issue" | "deduct";

export type ParsedLedgerAdjustment = {
  kind: LedgerAdjustmentKind;
  amount: number;
  reason: string;
  confirmation: string;
};

function toStrictPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseLedgerAdjustmentPayload(
  payload: unknown,
):
  | { ok: true; value: ParsedLedgerAdjustment }
  | { ok: false; error: string } {
  const body = payload as {
    type?: unknown;
    kind?: unknown;
    amount?: unknown;
    reason?: unknown;
    confirmation?: unknown;
  };

  const kind = body?.type ?? body?.kind;
  if (kind !== "issue" && kind !== "deduct") {
    return { ok: false, error: "type must be either issue or deduct" };
  }

  const amount = toStrictPositiveInt(body?.amount);
  if (!amount) {
    return { ok: false, error: "amount must be a positive integer" };
  }

  const reason = toCleanString(body?.reason);
  if (!reason) {
    return { ok: false, error: "reason is required" };
  }

  const confirmation = toCleanString(body?.confirmation);
  if (confirmation !== LEDGER_ADJUSTMENT_CONFIRMATION) {
    return {
      ok: false,
      error: `confirmation must equal ${LEDGER_ADJUSTMENT_CONFIRMATION}`,
    };
  }

  return {
    ok: true,
    value: {
      kind,
      amount,
      reason,
      confirmation,
    },
  };
}

export function parseAuditLimit(rawLimit: string | null): number {
  const parsed = rawLimit ? Number(rawLimit) : 100;
  if (!Number.isFinite(parsed)) return 100;
  const asInt = Math.trunc(parsed);
  if (asInt < 1) return 1;
  if (asInt > 500) return 500;
  return asInt;
}
