import { describe, expect, test } from "bun:test";

const { buildNudgeText, deadlineLine } = await import("./templates.ts");
const { NUDGE_KINDS } = await import("./kinds.ts");

const ctx = {
  appBaseUrl: "https://carnival.test/",
  deadlineIso: "2026-10-31T23:59:59.000Z",
  daysLeft: 17,
};

function planned(overrides = {}) {
  return {
    userId: "u1",
    name: "Ada Lovelace",
    slackId: "U1",
    createdAtIso: "2026-07-01T00:00:00.000Z",
    kind: "never_connected",
    variant: "default",
    projectId: "p1",
    projectName: "Tab Rot",
    devlogSeconds: 2.5 * 3600,
    hackatimeSeconds: null,
    sendNumber: 1,
    storedKind: "auto_never_connected",
    ...overrides,
  };
}

describe("deadlineLine", () => {
  test("only within three weeks, with day-aware wording", () => {
    expect(deadlineLine({ ...ctx, daysLeft: 30 })).toBeNull();
    expect(deadlineLine({ ...ctx, daysLeft: null })).toBeNull();
    expect(deadlineLine(ctx)).toBe("⏰ The Carnival closes in 17 days (October 31).");
    expect(deadlineLine({ ...ctx, daysLeft: 1 })).toBe("⏰ The Carnival closes tomorrow (October 31).");
    expect(deadlineLine({ ...ctx, daysLeft: 0 })).toBe("⏰ The Carnival closes today (October 31).");
  });
});

describe("buildNudgeText", () => {
  test("every kind renders with greeting, trimmed base URL, deadline and opt-out footer", () => {
    for (const kind of NUDGE_KINDS) {
      const text = buildNudgeText(planned({ kind, storedKind: `auto_${kind}` }), ctx);
      expect(text.startsWith("Hey Ada! 🎪")).toBe(true);
      expect(text).toContain("https://carnival.test/");
      expect(text).not.toContain("https://carnival.test//");
      expect(text).toContain("closes in 17 days");
      expect(text).toContain("https://carnival.test/account");
    }
  });

  test("second send is framed as a last call", () => {
    const text = buildNudgeText(planned({ kind: "hours_unsubmitted", sendNumber: 2 }), ctx);
    expect(text.startsWith("Hey Ada, last call! 🎪")).toBe(true);
    expect(text).toContain("Unsubmitted hours don't get paid out.");
  });

  test("hours_unsubmitted mentions hours, the project and its link; repeat shippers get their own lead", () => {
    const text = buildNudgeText(planned({ kind: "hours_unsubmitted" }), ctx);
    expect(text).toContain("2.5 hours on *Tab Rot*");
    expect(text).toContain("https://carnival.test/projects/p1");
    const repeat = buildNudgeText(planned({ kind: "hours_unsubmitted", variant: "repeat_shipper" }), ctx);
    expect(repeat).toContain("already shipped on Carnival");
  });

  test("project_no_hours_7d variants point at the right fix", () => {
    const noToken = buildNudgeText(planned({ kind: "project_no_hours_7d", variant: "no_token" }), ctx);
    expect(noToken).toContain("Hackatime isn't connected");
    const hasTime = buildNudgeText(planned({ kind: "project_no_hours_7d", variant: "has_hackatime_time" }), ctx);
    expect(hasTime).toContain("no devlog has claimed it yet");
    const noTime = buildNudgeText(planned({ kind: "project_no_hours_7d", variant: "no_hackatime_time" }), ctx);
    expect(noTime).toContain("editor plugin isn't set up");
  });

  test("never_connected reconnect variant and fallback name", () => {
    const text = buildNudgeText(
      planned({ kind: "never_connected", variant: "needs_reconnect", name: null }),
      { ...ctx, daysLeft: 40 },
    );
    expect(text.startsWith("Hey there! 🎪")).toBe(true);
    expect(text).toContain("was revoked");
    expect(text).not.toContain("⏰");
  });
});
