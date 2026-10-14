import { describe, expect, test } from "bun:test";

const { daysUntil, isDeadlinePassed, pickNudgeForUser, planNudgeRun } = await import("./policy.ts");
const { DEFAULT_NUDGE_POLICY } = await import("./kinds.ts");

const now = new Date("2026-10-14T16:00:00.000Z");

function candidate(overrides = {}) {
  return {
    userId: "u1",
    name: "Ada Lovelace",
    slackId: "U1",
    createdAtIso: "2026-07-01T00:00:00.000Z",
    kind: "never_connected",
    variant: "default",
    projectId: null,
    projectName: null,
    devlogSeconds: 0,
    hackatimeSeconds: null,
    ...overrides,
  };
}

describe("daysUntil / isDeadlinePassed", () => {
  test("counts UTC calendar days to the deadline and goes negative after", () => {
    expect(daysUntil("2026-10-31T23:59:59.000Z", now)).toBe(17);
    // Later the same UTC day is "today", not "tomorrow".
    expect(daysUntil("2026-10-14T20:00:00.000Z", now)).toBe(0);
    expect(daysUntil("2026-10-15T00:30:00.000Z", now)).toBe(1);
    expect(daysUntil("2026-10-01T00:00:00.000Z", now)).toBeLessThan(0);
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("nope", now)).toBeNull();
  });

  test("deadline passed only when now is at or after it", () => {
    expect(isDeadlinePassed("2026-10-31T23:59:59.000Z", now)).toBe(false);
    expect(isDeadlinePassed("2026-10-14T16:00:00.000Z", now)).toBe(true);
    expect(isDeadlinePassed(null, now)).toBe(false);
  });
});

describe("pickNudgeForUser", () => {
  test("highest-priority kind wins and the first send is number 1", () => {
    const pick = pickNudgeForUser(
      [candidate({ kind: "never_connected" }), candidate({ kind: "hours_unsubmitted" })],
      [],
      now,
    );
    expect(pick.planned.kind).toBe("hours_unsubmitted");
    expect(pick.planned.sendNumber).toBe(1);
    expect(pick.planned.storedKind).toBe("auto_hours_unsubmitted");
  });

  test("any nudge (manual or automated) in the quiet window blocks the send", () => {
    const pick = pickNudgeForUser(
      [candidate()],
      [{ kind: "stalled_with_hours", createdAtIso: "2026-10-10T00:00:00.000Z" }],
      now,
    );
    expect(pick.skipped.reason).toBe("recently_nudged");
  });

  test("lifetime cap per kind stops the third send; second send is numbered 2", () => {
    const history = [
      { kind: "auto_never_connected", createdAtIso: "2026-09-01T00:00:00.000Z" },
      { kind: "auto_never_connected", createdAtIso: "2026-09-20T00:00:00.000Z" },
    ];
    expect(pickNudgeForUser([candidate()], history, now).skipped.reason).toBe("kind_cap_reached");
    expect(pickNudgeForUser([candidate()], history.slice(0, 1), now).planned.sendNumber).toBe(2);
  });

  test("per-kind cooldown applies even with a short global quiet window", () => {
    const policy = { ...DEFAULT_NUDGE_POLICY, globalQuietDays: 1, cooldownDays: 6 };
    const pick = pickNudgeForUser(
      [candidate()],
      [{ kind: "auto_never_connected", createdAtIso: "2026-10-10T00:00:00.000Z" }],
      now,
      policy,
    );
    expect(pick.skipped.reason).toBe("kind_cooldown");
  });

  test("other kinds' history does not count toward this kind's cap", () => {
    const history = [
      { kind: "auto_connected_no_project", createdAtIso: "2026-09-01T00:00:00.000Z" },
      { kind: "auto_connected_no_project", createdAtIso: "2026-09-20T00:00:00.000Z" },
    ];
    expect(pickNudgeForUser([candidate()], history, now).planned.sendNumber).toBe(1);
  });

  test("returns null without candidates", () => {
    expect(pickNudgeForUser([], [], now)).toBeNull();
  });
});

describe("planNudgeRun", () => {
  test("stops everything once the deadline has passed", () => {
    const plan = planNudgeRun({
      candidates: [candidate(), candidate({ userId: "u2", slackId: "U2" })],
      historyByUser: new Map(),
      now,
      deadlineIso: "2026-10-01T00:00:00.000Z",
      maxSends: 10,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["deadline_passed", "deadline_passed"]);
  });

  test("one nudge per user, ordered by kind priority then oldest account, capped", () => {
    const candidates = [
      candidate({ userId: "late", slackId: "UL", kind: "never_connected", createdAtIso: "2026-10-01T00:00:00.000Z" }),
      candidate({ userId: "early", slackId: "UE", kind: "never_connected", createdAtIso: "2026-06-01T00:00:00.000Z" }),
      candidate({ userId: "builder", slackId: "UB", kind: "hours_unsubmitted", createdAtIso: "2026-09-01T00:00:00.000Z" }),
      candidate({ userId: "builder", slackId: "UB", kind: "project_no_hours_7d", createdAtIso: "2026-09-01T00:00:00.000Z" }),
    ];
    const plan = planNudgeRun({
      candidates,
      historyByUser: new Map(),
      now,
      deadlineIso: "2026-10-31T23:59:59.000Z",
      maxSends: 2,
    });
    expect(plan.planned.map((p) => `${p.userId}:${p.kind}`)).toEqual([
      "builder:hours_unsubmitted",
      "early:never_connected",
    ]);
    expect(plan.skipped).toEqual([{ userId: "late", kind: "never_connected", reason: "over_run_cap" }]);
  });

  test("allowlist restricts sends to listed Slack IDs", () => {
    const plan = planNudgeRun({
      candidates: [candidate({ slackId: "U1" }), candidate({ userId: "u2", slackId: "U2" })],
      historyByUser: new Map(),
      now,
      deadlineIso: null,
      maxSends: 10,
      allowlist: new Set(["U2"]),
    });
    expect(plan.planned.map((p) => p.slackId)).toEqual(["U2"]);
    expect(plan.skipped).toEqual([{ userId: "u1", kind: "never_connected", reason: "not_in_allowlist" }]);
  });

  test("history skips are reported per user", () => {
    const plan = planNudgeRun({
      candidates: [candidate()],
      historyByUser: new Map([["u1", [{ kind: "auto_never_connected", createdAtIso: "2026-10-12T00:00:00.000Z" }]]]),
      now,
      deadlineIso: null,
      maxSends: 10,
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe("recently_nudged");
  });
});
