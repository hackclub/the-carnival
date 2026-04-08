import { describe, expect, test } from "bun:test";
import {
  buildReviewJustificationRequest,
  normalizeSnapshotSeconds,
  validateRequiredReviewJustification,
} from "./review-rules.ts";

describe("review-rules", () => {
  test("normalizes invalid Hackatime snapshots to zero seconds", () => {
    expect(normalizeSnapshotSeconds(null)).toBe(0);
    expect(normalizeSnapshotSeconds(NaN)).toBe(0);
    expect(normalizeSnapshotSeconds(-10)).toBe(0);
    expect(normalizeSnapshotSeconds(3599.9)).toBe(3599);
  });

  test("builds draft-shaped submission payloads without dropping multiple deflation reasons", () => {
    const request = buildReviewJustificationRequest({
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
      deflationReasons: ["scopeCouldNotBeVerified", "other"],
      deflationNote: "Scope verification was incomplete.",
    });

    expect(request).toEqual({
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
      deflationReasons: ["scopeCouldNotBeVerified", "other"],
      deflationNote: "Scope verification was incomplete.",
    });
  });

  test("uses the canonical Hackatime project name when provided", () => {
    const request = buildReviewJustificationRequest(
      {
        hackatimeProjectName: "edited-name",
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
        deflationReasons: ["scopeCouldNotBeVerified"],
        deflationNote: "Scope verification was incomplete.",
      },
      { hackatimeProjectName: "project-one" },
    );

    expect(request.hackatimeProjectName).toBe("project-one");
  });

  test("accepts normalized deflation payloads for compatibility", () => {
    const result = validateRequiredReviewJustification({
      value: {
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
      },
      decision: "approved",
      expectedHackatimeProjectName: "project-one",
      approvedHours: 3,
      loggedHackatimeHours: 4,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        decision: "approved",
        hackatimeProjectName: "project-one",
        deflation: {
          reduced: true,
          hoursReducedBy: 1,
          reasons: ["scopeCouldNotBeVerified", "other"],
          note: "Scope verification was incomplete.",
          reasonRequired: true,
        },
      },
    });
  });
});
