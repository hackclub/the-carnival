import { describe, expect, test } from "bun:test";
import {
  LEDGER_ADJUSTMENT_CONFIRMATION,
  parseAuditLimit,
  parseLedgerAdjustmentPayload,
} from "./admin-safety.ts";

describe("admin-safety", () => {
  test("parses a valid issue adjustment payload", () => {
    const result = parseLedgerAdjustmentPayload({
      kind: "issue",
      amount: 25,
      reason: "Manual correction",
      confirmation: LEDGER_ADJUSTMENT_CONFIRMATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("issue");
      expect(result.value.amount).toBe(25);
      expect(result.value.reason).toBe("Manual correction");
    }
  });

  test("rejects payloads without required confirmation", () => {
    const result = parseLedgerAdjustmentPayload({
      kind: "deduct",
      amount: 2,
      reason: "Reverse duplicate reward",
      confirmation: "CONFIRM",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("confirmation must equal");
    }
  });

  test("rejects non-positive amounts", () => {
    const result = parseLedgerAdjustmentPayload({
      kind: "issue",
      amount: 0,
      reason: "Invalid",
      confirmation: LEDGER_ADJUSTMENT_CONFIRMATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount must be a positive integer");
    }
  });

  test("defaults the reference type and accepts a predefined one", () => {
    const base = { kind: "issue", amount: 5, reason: "x", confirmation: LEDGER_ADJUSTMENT_CONFIRMATION };
    const defaulted = parseLedgerAdjustmentPayload(base);
    expect(defaulted.ok && defaulted.value.referenceType).toBe("admin_adjustment");
    const picked = parseLedgerAdjustmentPayload({ ...base, referenceType: "admin_refund" });
    expect(picked.ok && picked.value.referenceType).toBe("admin_refund");
  });

  test("rejects system and unknown reference types", () => {
    const base = { kind: "issue", amount: 5, reason: "x", confirmation: LEDGER_ADJUSTMENT_CONFIRMATION };
    expect(parseLedgerAdjustmentPayload({ ...base, referenceType: "project_grant" }).ok).toBe(false);
    expect(parseLedgerAdjustmentPayload({ ...base, referenceType: "whatever" }).ok).toBe(false);
  });

  test("rejects a reference type used with the wrong direction", () => {
    const result = parseLedgerAdjustmentPayload({
      kind: "deduct",
      amount: 5,
      reason: "x",
      referenceType: "admin_refund",
      confirmation: LEDGER_ADJUSTMENT_CONFIRMATION,
    });
    expect(result.ok).toBe(false);
  });

  test("parses and clamps audit limits", () => {
    expect(parseAuditLimit(null)).toBe(100);
    expect(parseAuditLimit("-5")).toBe(1);
    expect(parseAuditLimit("25")).toBe(25);
    expect(parseAuditLimit("9999")).toBe(500);
    expect(parseAuditLimit("bad")).toBe(100);
  });
});
