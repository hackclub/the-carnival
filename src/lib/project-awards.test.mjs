import { describe, expect, test } from "bun:test";

const {
  buildApprovedProjectAwardSummary,
  formatApprovedHoursLabel,
} = await import("./project-awards.ts");

describe("project award summaries", () => {
  test("formats approved hours without unnecessary trailing decimals", () => {
    expect(formatApprovedHoursLabel(7)).toBe("7h");
    expect(formatApprovedHoursLabel(7.5)).toBe("7.5h");
  });

  test("summarizes award basis for shipped and granted projects", () => {
    expect(
      buildApprovedProjectAwardSummary({
        status: "granted",
        approvedHours: 7.5,
      }),
    ).toEqual({
      approvedHoursLabel: "7.5h",
      tokensLabel: "70 tokens",
    });

    expect(
      buildApprovedProjectAwardSummary({
        status: "shipped",
        approvedHours: 3,
      }),
    ).toEqual({
      approvedHoursLabel: "3h",
      tokensLabel: "30 tokens",
    });
  });

  test("does not summarize unapproved or missing award data", () => {
    expect(
      buildApprovedProjectAwardSummary({
        status: "work-in-progress",
        approvedHours: 3,
      }),
    ).toBeNull();

    expect(
      buildApprovedProjectAwardSummary({
        status: "granted",
        approvedHours: null,
      }),
    ).toBeNull();
  });
});
