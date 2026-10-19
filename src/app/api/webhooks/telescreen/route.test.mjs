import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";

const state = {
  handledDeliveries: new Set(),
  localRow: null,
  applied: [],
  inserted: [],
};

// Minimal chainable db: select() reads either the delivery table or the
// submission row depending on which table `from` gets.
mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from(table) {
          return {
            where() {
              return {
                limit: async () => {
                  if (table?.[Symbol.for("drizzle:Name")] === "telescreen_webhook_delivery") {
                    return state.currentDelivery && state.handledDeliveries.has(state.currentDelivery)
                      ? [{ deliveryId: state.currentDelivery }]
                      : [];
                  }
                  return state.localRow ? [state.localRow] : [];
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(v) {
          return {
            onConflictDoNothing: async () => {
              state.inserted.push(v);
            },
          };
        },
      };
    },
  },
}));

mock.module("@/lib/telescreen/submissions", () => ({
  applyRobertProject: async (row, robert) => {
    state.applied.push({ row, robert });
    return row;
  },
  setCarnivalOutcome: async () => undefined,
  getTelescreenGrantGate: async () => ({ gate: { ok: true, needsDoubtfulAck: false }, submission: null }),
  createTelescreenSubmission: async () => null,
  sendTelescreenSubmission: async (row) => row,
  submitProjectToTelescreen: async () => null,
  ensureTelescreenSubmission: async () => null,
  refreshTelescreenSubmission: async (row) => row,
  getCurrentTelescreenSubmission: async () => null,
  listTelescreenSubmissions: async () => [],
  toTelescreenView: (row) => row,
  telescreenExternalId: (id, at) => `carnival:${id}:${at.getTime()}`,
  TELESCREEN_OPEN_STATES: [],
}));

const { POST } = await import("./route.ts");

const SECRET = "whsec_test";

function signedRequest(payload, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const body = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  state.currentDelivery = payload.deliveryId;
  return new Request("http://localhost/api/webhooks/telescreen", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Robert-Timestamp": String(timestamp),
      "X-Robert-Signature": signature,
      "X-Robert-Delivery": payload.deliveryId,
      "X-Robert-Event": payload.event,
    },
    body,
  });
}

function outcomePayload(outcome, deliveryId = "delivery-1") {
  return {
    event: "outcome.set",
    deliveryId,
    eventId: "carnival",
    projectId: "robert-1",
    projectName: "Ducky Drive",
    submitter: { profileId: "p-1", slackId: "U01", hackatimeId: 42 },
    outcome: { reviewedAt: "2026-10-19T12:00:00.000Z", reviewerName: null, ...outcome },
  };
}

beforeEach(() => {
  process.env.ROBERT_WEBHOOK_SECRET = SECRET;
  state.handledDeliveries = new Set();
  state.localRow = { id: "row-1", projectId: "project-1", robertProjectId: "robert-1", reviewNote: null };
  state.applied = [];
  state.inserted = [];
});

describe("POST /api/webhooks/telescreen", () => {
  test("refuses when no webhook secret is configured", async () => {
    delete process.env.ROBERT_WEBHOOK_SECRET;
    const res = await POST(signedRequest(outcomePayload({ status: "rejected", reason: "x", trustScore: 2 })));
    expect(res.status).toBe(503);
  });

  test("rejects a bad signature without touching anything", async () => {
    const res = await POST(
      signedRequest(outcomePayload({ status: "rejected", reason: "x", trustScore: 2 }), { secret: "wrong" }),
    );
    expect(res.status).toBe(401);
    expect(state.applied).toHaveLength(0);
  });

  test("a score of 4 or below is applied as a fraud rejection with the note as review", async () => {
    const res = await POST(
      signedRequest(outcomePayload({ status: "rejected", reason: "Bot heartbeats.", trustScore: 4 })),
    );
    expect(res.status).toBe(204);
    expect(state.applied).toHaveLength(1);
    expect(state.applied[0].robert).toMatchObject({
      state: "rejected_fraud",
      trustScore: 4,
      review: { trustScore: 4, note: "Bot heartbeats." },
      outcome: { status: "rejected", reason: "Bot heartbeats." },
    });
    expect(state.inserted[0]).toMatchObject({ deliveryId: "delivery-1", event: "outcome.set" });
  });

  test("an organizer decision is applied as decided", async () => {
    await POST(signedRequest(outcomePayload({ status: "approved", reason: null, trustScore: 8 })));
    expect(state.applied[0].robert).toMatchObject({ state: "decided", trustScore: 8, review: null });
  });

  test("a repeated delivery is acknowledged without reprocessing", async () => {
    state.handledDeliveries.add("delivery-1");
    const res = await POST(signedRequest(outcomePayload({ status: "rejected", reason: "x", trustScore: 1 })));
    expect(res.status).toBe(204);
    expect(state.applied).toHaveLength(0);
  });

  test("an outcome for a project Carnival doesn't know is acknowledged", async () => {
    state.localRow = null;
    const res = await POST(signedRequest(outcomePayload({ status: "rejected", reason: "x", trustScore: 1 })));
    expect(res.status).toBe(204);
    expect(state.applied).toHaveLength(0);
  });

  test("a ping is acknowledged", async () => {
    const res = await POST(
      signedRequest({ event: "ping", deliveryId: "ping-1", eventId: "carnival", sentAt: new Date().toISOString() }),
    );
    expect(res.status).toBe(204);
    expect(state.inserted[0]).toMatchObject({ deliveryId: "ping-1", event: "ping" });
  });
});
