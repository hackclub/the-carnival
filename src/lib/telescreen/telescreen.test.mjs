import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

const { evaluateTelescreenGrantGate, telescreenBandForScore } = await import("./shared.ts");
const { verifyRobertWebhookSignature } = await import("./webhook-signature.ts");
const { buildStaffThreadReply } = await import("../notifications/review-messages.ts");

describe("telescreenBandForScore", () => {
  test("maps Robert's score bands: 1–4 fraud, 5–7 doubtful, 8–10 clean", () => {
    expect([1, 4, 5, 7, 8, 10].map(telescreenBandForScore)).toEqual([
      "fraud",
      "fraud",
      "doubtful",
      "doubtful",
      "clean",
      "clean",
    ]);
  });

  test("no score means no band", () => {
    expect(telescreenBandForScore(null)).toBeNull();
    expect(telescreenBandForScore(undefined)).toBeNull();
    expect(telescreenBandForScore(Number.NaN)).toBeNull();
  });
});

describe("evaluateTelescreenGrantGate", () => {
  const gate = (submission, enabled = true) => evaluateTelescreenGrantGate({ enabled, submission });

  test("passes everything when the integration is disabled", () => {
    expect(gate(null, false)).toEqual({ ok: true, needsDoubtfulAck: false });
  });

  test("blocks a project that never reached Telescreen", () => {
    expect(gate(null)).toMatchObject({ ok: false, code: "telescreen_not_sent" });
    expect(gate({ state: "pending", trustScore: null, outcomeStatus: null })).toMatchObject({
      ok: false,
      code: "telescreen_not_sent",
    });
  });

  test("blocks until a fraud reviewer has scored it", () => {
    expect(gate({ state: "awaiting_review", trustScore: null, outcomeStatus: null })).toMatchObject({
      ok: false,
      code: "telescreen_awaiting_review",
    });
  });

  test("blocks a fraud rejection", () => {
    expect(gate({ state: "rejected_fraud", trustScore: 3, outcomeStatus: "rejected" })).toMatchObject({
      ok: false,
      code: "telescreen_fraud",
    });
  });

  test("requires acknowledgement for a doubtful score", () => {
    expect(gate({ state: "awaiting_outcome", trustScore: 6, outcomeStatus: null })).toEqual({
      ok: true,
      needsDoubtfulAck: true,
    });
  });

  test("passes a clean score", () => {
    expect(gate({ state: "awaiting_outcome", trustScore: 9, outcomeStatus: null })).toEqual({
      ok: true,
      needsDoubtfulAck: false,
    });
  });

  test("an already-recorded approval passes; a recorded rejection blocks", () => {
    expect(gate({ state: "decided", trustScore: 8, outcomeStatus: "approved" })).toMatchObject({ ok: true });
    expect(gate({ state: "decided", trustScore: 8, outcomeStatus: "rejected" })).toMatchObject({
      ok: false,
      code: "telescreen_outcome_conflict",
    });
  });
});

describe("verifyRobertWebhookSignature", () => {
  const secret = "whsec_test";
  const rawBody = JSON.stringify({ event: "ping", deliveryId: "d-1" });
  const now = 1_790_172_157;
  const sign = (ts, body = rawBody, key = secret) =>
    "sha256=" + createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");

  test("accepts a correctly signed, fresh request", () => {
    expect(
      verifyRobertWebhookSignature({ secret, timestamp: String(now), signature: sign(now), rawBody, nowSeconds: now }),
    ).toBe(true);
  });

  test("rejects a tampered body, wrong secret, or missing headers", () => {
    const base = { secret, timestamp: String(now), nowSeconds: now };
    expect(verifyRobertWebhookSignature({ ...base, signature: sign(now), rawBody: rawBody + " " })).toBe(false);
    expect(verifyRobertWebhookSignature({ ...base, signature: sign(now, rawBody, "other"), rawBody })).toBe(false);
    expect(verifyRobertWebhookSignature({ ...base, signature: null, rawBody })).toBe(false);
    expect(verifyRobertWebhookSignature({ ...base, timestamp: null, signature: sign(now), rawBody })).toBe(false);
  });

  test("rejects timestamps more than five minutes from our clock", () => {
    const stale = now - 301;
    expect(
      verifyRobertWebhookSignature({ secret, timestamp: String(stale), signature: sign(stale), rawBody, nowSeconds: now }),
    ).toBe(false);
    const edge = now - 300;
    expect(
      verifyRobertWebhookSignature({ secret, timestamp: String(edge), signature: sign(edge), rawBody, nowSeconds: now }),
    ).toBe(true);
  });

  test("rejects a non-numeric timestamp", () => {
    expect(
      verifyRobertWebhookSignature({ secret, timestamp: "12a", signature: sign("12a"), rawBody, nowSeconds: now }),
    ).toBe(false);
  });
});

describe("staff thread copy for Telescreen scores", () => {
  test("a fraud score that dismissed the project quotes the internal note", () => {
    const text = buildStaffThreadReply("Ducky Drive", {
      kind: "telescreen_scored",
      trustScore: 2,
      note: "Heartbeats from a bot.",
      band: "fraud",
      action: "dismissed",
    });
    expect(text).toContain("2/10 (fraud)");
    expect(text).toContain("dismissed automatically");
    expect(text).toContain("Heartbeats from a bot.");
  });

  test("a fraud score on a granted project asks for a human", () => {
    const text = buildStaffThreadReply("Ducky Drive", {
      kind: "telescreen_scored",
      trustScore: 4,
      note: null,
      band: "fraud",
      action: "already_granted",
    });
    expect(text).toContain("already granted");
  });

  test("a doubtful score mentions the acknowledgement", () => {
    const text = buildStaffThreadReply("Ducky Drive", {
      kind: "telescreen_scored",
      trustScore: 6,
      note: null,
      band: "doubtful",
      action: null,
    });
    expect(text).toContain("6/10 (doubtful)");
  });
});
