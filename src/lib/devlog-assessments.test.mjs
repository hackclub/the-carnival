import { describe, expect, test } from "bun:test";

const {
  assessmentSecondsToApprovedHours,
  effectiveSecondsForAssessment,
  isValidAssessmentDecision,
  sumAssessedSeconds,
} = await import("./devlog-assessments.ts");

describe("isValidAssessmentDecision", () => {
  test("accepts known values", () => {
    expect(isValidAssessmentDecision("accepted")).toBe(true);
    expect(isValidAssessmentDecision("rejected")).toBe(true);
    expect(isValidAssessmentDecision("adjusted")).toBe(true);
  });
  test("rejects unknown values", () => {
    expect(isValidAssessmentDecision("approved")).toBe(false);
    expect(isValidAssessmentDecision("")).toBe(false);
    expect(isValidAssessmentDecision(null)).toBe(false);
  });
});

describe("effectiveSecondsForAssessment", () => {
  test("accepted uses full durationSeconds", () => {
    const out = effectiveSecondsForAssessment(
      { devlogId: "d1", durationSeconds: 3600 },
      { decision: "accepted" },
    );
    expect(out).toBe(3600);
  });
  test("rejected contributes 0", () => {
    const out = effectiveSecondsForAssessment(
      { devlogId: "d1", durationSeconds: 3600 },
      { decision: "rejected" },
    );
    expect(out).toBe(0);
  });
  test("adjusted caps at durationSeconds", () => {
    const out = effectiveSecondsForAssessment(
      { devlogId: "d1", durationSeconds: 3600 },
      { decision: "adjusted", adjustedSeconds: 9999 },
    );
    expect(out).toBe(3600);
  });
  test("adjusted uses provided seconds when under cap", () => {
    const out = effectiveSecondsForAssessment(
      { devlogId: "d1", durationSeconds: 3600 },
      { decision: "adjusted", adjustedSeconds: 1200 },
    );
    expect(out).toBe(1200);
  });
  test("adjusted returns 0 when missing adjusted seconds", () => {
    const out = effectiveSecondsForAssessment(
      { devlogId: "d1", durationSeconds: 3600 },
      { decision: "adjusted" },
    );
    expect(out).toBe(0);
  });
});

describe("sumAssessedSeconds", () => {
  test("sums across devlogs, ignoring missing", () => {
    const devlogs = [
      { devlogId: "a", durationSeconds: 3600 },
      { devlogId: "b", durationSeconds: 1800 },
      { devlogId: "c", durationSeconds: 7200 },
    ];
    const assessments = new Map([
      ["a", { decision: "accepted" }],
      ["b", { decision: "rejected" }],
      ["c", { decision: "adjusted", adjustedSeconds: 1800 }],
    ]);
    expect(sumAssessedSeconds({ devlogs, assessments })).toBe(3600 + 0 + 1800);
  });
});

describe("assessmentSecondsToApprovedHours", () => {
  test("snaps down to 0.1h", () => {
    expect(assessmentSecondsToApprovedHours(3600)).toBeCloseTo(1, 5);
    expect(assessmentSecondsToApprovedHours(3600 + 300)).toBeCloseTo(1, 5); // 1h5m -> 1.0h
    expect(assessmentSecondsToApprovedHours(3600 + 6 * 60)).toBeCloseTo(1.1, 5); // 1h6m -> 1.1h
  });
  test("returns 0 for short totals", () => {
    expect(assessmentSecondsToApprovedHours(59)).toBe(0);
  });
});
