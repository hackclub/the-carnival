import { describe, expect, test } from "bun:test";
import { formatAirtableHoursJustification } from "./airtable.ts";

function buildReviewJustification(overrides = {}) {
  return {
    decision: "approved",
    hackatimeProjectName: "project-one",
    evidence: {
      hackatimeProjectReviewed: true,
      githubReviewed: true,
      sourceCodeReviewed: true,
      demoReviewed: true,
      manualTestPerformed: true,
    },
    reviewDateRange: {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    },
    deflation: {
      reduced: true,
      hoursReducedBy: 1,
      reasons: ["scopeCouldNotBeVerified", "other"],
      note: "Scope verification was incomplete.",
      reasonRequired: true,
    },
    ...overrides,
  };
}

describe("airtable hours justification", () => {
  test("formats one structured review with evidence, range, and deflation details", () => {
    const output = formatAirtableHoursJustification([
      {
        reviewerName: "Reviewer One",
        decision: "approved",
        message: "Approved with reduction.",
        reviewJustification: buildReviewJustification(),
      },
    ]);

    expect(output).toContain("Review 1");
    expect(output).toContain("Reviewer: Reviewer One");
    expect(output).toContain("Decision: Approved");
    expect(output).toContain("Hackatime project: project-one");
    expect(output).toContain("Reviewed range: 2026-03-01 to 2026-03-31");
    expect(output).toContain("- Hackatime project reviewed: Yes");
    expect(output).toContain("- Deflation reasons: Some claimed work could not be verified, Other (add context in note)");
    expect(output).toContain("- Deflation note: Scope verification was incomplete.");
    expect(output).toContain("Review comment:");
    expect(output).toContain("Approved with reduction.");
  });

  test("aggregates multiple non-comment reviews and excludes comment reviews", () => {
    const output = formatAirtableHoursJustification([
      {
        reviewerName: "Reviewer One",
        decision: "approved",
        message: "Approved with reduction.",
        reviewJustification: buildReviewJustification(),
      },
      {
        reviewerName: "Comment Reviewer",
        decision: "comment",
        message: "Needs more detail.",
        reviewJustification: null,
      },
      {
        reviewerName: "Reviewer Two",
        decision: "rejected",
        message: "Needs revision.",
        reviewJustification: buildReviewJustification({
          decision: "rejected",
          deflation: {
            reduced: false,
            hoursReducedBy: 0,
            reasons: [],
            note: null,
            reasonRequired: false,
          },
        }),
      },
    ]);

    expect(output).toContain("Review 1");
    expect(output).toContain("Review 2");
    expect(output).toContain("\n\n---\n\n");
    expect(output).not.toContain("Comment Reviewer");
    expect(output.indexOf("Reviewer: Reviewer One")).toBeLessThan(
      output.indexOf("Reviewer: Reviewer Two"),
    );
  });

  test("falls back cleanly when structured review confirmation is unavailable", () => {
    const output = formatAirtableHoursJustification([
      {
        reviewerName: "Reviewer One",
        decision: "approved",
        message: "Approved.",
        reviewJustification: null,
      },
    ]);

    expect(output).toContain("Structured review confirmation: unavailable");
    expect(output).toContain("Review comment:");
    expect(output).toContain("Approved.");
  });
});
